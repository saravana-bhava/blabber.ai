import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import {
  processGoatPayment,
  type GoatPaymentMetadata,
  type GoatCardInput,
  type GoatBillingInput,
  type GoatTransactionType,
} from '@/lib/payments/goat';
import { calculatePaymentSplits } from '@/lib/payments/calculate-splits';
import { calculatePaymentSplitsStore } from '@/lib/payments/calculate-splits-store';
import {
  createPPVPurchaseNotification,
  createTipNotification,
  createProductPurchaseNotification,
  createNewSubscriptionNotification,
} from '@/app/actions/notificationActions';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const real = request.headers.get('x-real-ip');
  if (real) return real;
  return '';
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      transactionType,
      amountCents,
      metadata,
      card,
      billing,
    } = body as {
      transactionType: GoatTransactionType;
      amountCents: number;
      metadata: GoatPaymentMetadata;
      card?: GoatCardInput;
      billing?: GoatBillingInput;
      // returnUrl is accepted but unused — GOAT's documented flow doesn't
      // redirect; if 3DS is added later it goes through /3ds/{id}/check, not
      // a browser redirect.
      returnUrl?: string;
    };

    if (!transactionType || !amountCents || !metadata?.userId) {
      return NextResponse.json(
        { error: 'Missing transactionType, amountCents, or metadata.userId' },
        { status: 400 }
      );
    }
    if (metadata.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!card?.number || !card?.exp_month || !card?.exp_year || !card?.cvc) {
      return NextResponse.json(
        { error: 'Card details required' },
        { status: 400 }
      );
    }

    // GOAT (like Onyx) is a high-risk processor that traditionally accepts AVS-style
    // billing fields. Use placeholders for fields the user didn't enter so we always
    // send a non-empty payload — adjust if the live API rejects placeholders.
    const placeholderBilling: GoatBillingInput = {
      first_name: 'Customer',
      last_name: 'User',
      email: '',
      phone_number: '1',
      address: 'N/A',
      city: 'N/A',
      state: 'N/A',
      zip: '00000',
    };
    const effectiveBilling: GoatBillingInput = { ...placeholderBilling, ...(billing || {}) };

    const result = await processGoatPayment({
      amountCents,
      currency: 'USD',
      metadata,
      card,
      billing: effectiveBilling,
      customer_ip: getClientIp(request),
      send_receipt: false,
    });

    // PENDING is unusual for cards but possible for high-risk fraud review or
    // ACH-style async settlement. Park it so the webhook (or a future poll loop)
    // can finalize the order once GOAT moves it to a terminal state.
    if (result.status === 'PENDING' && result.transaction_id) {
      await supabaseAdmin.from('pending_goat_payments').insert({
        transaction_id: result.transaction_id,
        user_id: user.id,
        transaction_type: transactionType,
        metadata_json: metadata,
      });
      return NextResponse.json({
        status: 'pending',
        transaction_id: result.transaction_id,
        message: result.message || 'Payment is processing. You will be notified once it completes.',
      });
    }

    if (result.status === 'SUCCESS' && result.transaction_id) {
      const providerDetails = {
        transactionId: result.transaction_id,
        amount: amountCents / 100,
        currency: 'USD',
        status: 'SUCCESS',
      };
      return runHandler(transactionType, metadata, result.transaction_id, providerDetails);
    }

    return NextResponse.json(
      { error: result.message || 'Payment failed' },
      { status: 400 }
    );
  } catch (err) {
    console.error('GOAT process-payment error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function runHandler(
  transactionType: GoatTransactionType,
  metadata: GoatPaymentMetadata,
  transactionId: string,
  providerDetails: Record<string, unknown>
): Promise<NextResponse> {
  const { userId, amountCents, postId, messageId, creatorId, productId, subscriptionId } = metadata;

  switch (transactionType) {
    case 'credit': {
      const credits = metadata.credits;
      if (!credits) return NextResponse.json({ error: 'Missing credits' }, { status: 400 });
      const { error: txErr } = await supabaseAdmin.from('credit_transactions').insert({
        user_id: userId,
        amount_cents: amountCents,
        credits_purchased: parseInt(credits),
        currency: 'USD',
        payment_provider: 'goat',
        status: 'succeeded',
        provider_transaction_reference: transactionId,
        provider_specific_details: providerDetails,
      });
      if (txErr) return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
      const { data: profile } = await supabaseAdmin.from('profiles').select('credits').eq('id', userId).single();
      await supabaseAdmin
        .from('profiles')
        .update({ credits: (profile?.credits || 0) + parseInt(credits) })
        .eq('id', userId);
      return NextResponse.json({ status: 'success', transaction_id: transactionId });
    }

    case 'tip': {
      if (!creatorId) return NextResponse.json({ error: 'Missing creatorId' }, { status: 400 });
      const { creatorShare, platformShare, agencyShare, agencyProfileId } =
        await calculatePaymentSplits(amountCents, creatorId);
      const { error: txErr } = await supabaseAdmin.from('tip_transactions').insert({
        user_id: userId,
        post_id: postId || null,
        creator_id: creatorId,
        amount_cents: amountCents,
        currency: 'USD',
        payment_provider: 'goat',
        status: 'succeeded',
        provider_transaction_reference: transactionId,
        provider_specific_details: providerDetails,
        creator_share_cents: creatorShare,
        platform_share_cents: platformShare,
        agency_share_cents: agencyShare > 0 ? agencyShare : null,
        agency_profile_id: agencyProfileId || null,
      });
      if (txErr) return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
      try {
        const { data: tipperProfile } = await supabaseAdmin
          .from('profiles')
          .select('username')
          .eq('id', userId)
          .single();
        if (tipperProfile?.username) {
          await createTipNotification({
            creatorId,
            tipperId: userId,
            tipperUsername: tipperProfile.username,
            amount: amountCents / 100,
            postId,
          });
        }
      } catch (_) {}
      return NextResponse.json({ status: 'success', transaction_id: transactionId });
    }

    case 'ppv': {
      let effectiveCreatorId: string;
      if (messageId) {
        const { data: msg } = await supabaseAdmin
          .from('messages')
          .select('sender_id')
          .eq('id', messageId)
          .single();
        if (!msg) return NextResponse.json({ error: 'Message not found' }, { status: 404 });
        effectiveCreatorId = msg.sender_id;
      } else if (postId) {
        const { data: post } = await supabaseAdmin
          .from('posts')
          .select('user_id')
          .eq('id', postId)
          .single();
        if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
        effectiveCreatorId = post.user_id;
      } else {
        return NextResponse.json({ error: 'Missing postId or messageId' }, { status: 400 });
      }
      const { creatorShare, platformShare, agencyShare, agencyProfileId } =
        await calculatePaymentSplits(amountCents, effectiveCreatorId);
      const insertData: Record<string, unknown> = {
        user_id: userId,
        amount_cents: amountCents,
        currency: 'USD',
        payment_provider: 'goat',
        status: 'succeeded',
        provider_transaction_reference: transactionId,
        provider_specific_details: providerDetails,
        creator_share_cents: creatorShare,
        platform_share_cents: platformShare,
        agency_share_cents: agencyShare > 0 ? agencyShare : null,
        agency_profile_id: agencyProfileId || null,
      };
      if (messageId) (insertData as Record<string, unknown>).message_id = messageId;
      else (insertData as Record<string, unknown>).post_id = postId;
      const { data: tx, error: txErr } = await supabaseAdmin
        .from('ppv_transactions')
        .insert(insertData)
        .select()
        .single();
      if (txErr) return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
      if (messageId) {
        await supabaseAdmin.from('messages').update({ PPV_transaction_id: tx.id }).eq('id', messageId);
      }
      if (postId) {
        try {
          const { data: buyerProfile } = await supabaseAdmin
            .from('profiles')
            .select('username')
            .eq('id', userId)
            .single();
          if (buyerProfile?.username) {
            await createPPVPurchaseNotification({
              creatorId: effectiveCreatorId,
              buyerId: userId,
              buyerUsername: buyerProfile.username,
              postId,
              amount: amountCents / 100,
            });
          }
        } catch (_) {}
      }
      return NextResponse.json({ status: 'success', transaction_id: transactionId });
    }

    case 'product': {
      if (!productId) return NextResponse.json({ error: 'Missing productId' }, { status: 400 });
      const { data: product } = await supabaseAdmin
        .from('creator_products')
        .select('*')
        .eq('id', productId)
        .single();
      if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      const { creatorShare, platformShare, agencyShare, agencyProfileId } =
        await calculatePaymentSplitsStore(amountCents, product.creator_profile_id);
      const { data: tx, error: txErr } = await supabaseAdmin
        .from('creator_product_transactions')
        .insert({
          user_id: userId,
          creator_product_id: productId,
          amount_cents: amountCents,
          currency: 'USD',
          payment_provider: 'goat',
          status: 'succeeded',
          provider_transaction_reference: transactionId,
          provider_specific_details: providerDetails,
          creator_share_cents: creatorShare,
          platform_share_cents: platformShare,
          agency_share_cents: agencyShare > 0 ? agencyShare : null,
          agency_profile_id: agencyProfileId || null,
        })
        .select()
        .single();
      if (txErr) return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
      await supabaseAdmin.from('creator_product_orders').insert({
        creator_product_id: productId,
        user_id: userId,
        creator_product_transaction_id: tx.id,
        quantity: 1,
        order_status: 'paid',
      });
      try {
        const { data: buyerProfile } = await supabaseAdmin
          .from('profiles')
          .select('username')
          .eq('id', userId)
          .single();
        if (buyerProfile?.username) {
          await createProductPurchaseNotification({
            creatorId: product.creator_profile_id,
            buyerId: userId,
            buyerUsername: buyerProfile.username,
            productName: product.product_name,
            amount: amountCents / 100,
          });
        }
      } catch (_) {}
      return NextResponse.json({ status: 'success', transaction_id: transactionId });
    }

    case 'subscription': {
      if (!creatorId) return NextResponse.json({ error: 'Missing creatorId' }, { status: 400 });
      const { data: creator } = await supabaseAdmin
        .from('creators')
        .select('subscription_price_cents, subscription_interval')
        .eq('profile_id', creatorId)
        .single();
      if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
      const paymentAmountCents = creator.subscription_price_cents ?? amountCents;
      const { creatorShare, platformShare, agencyShare, agencyProfileId } =
        await calculatePaymentSplits(paymentAmountCents, creatorId);
      const now = new Date();
      const periodEnds = new Date(now);
      if (creator.subscription_interval === 'month') periodEnds.setMonth(periodEnds.getMonth() + 1);
      else periodEnds.setFullYear(periodEnds.getFullYear() + 1);

      let subId: string;
      if (subscriptionId) {
        const { error: subUpdateErr } = await supabaseAdmin
          .from('subscriptions')
          .update({
            status: 'active',
            current_period_ends_at: periodEnds.toISOString(),
            payment_provider: 'goat',
            provider_subscription_id: `goat_${transactionId}`,
            price_at_time_of_subscription_cents: creator.subscription_price_cents,
            interval_at_time_of_subscription: creator.subscription_interval,
            canceled_at: null,
          })
          .eq('id', subscriptionId);
        if (subUpdateErr) {
          console.error('GOAT subscription update failed:', subUpdateErr);
          return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
        }
        subId = subscriptionId;
      } else {
        const { data: newSub } = await supabaseAdmin
          .from('subscriptions')
          .insert({
            follower_id: userId,
            following_id: creatorId,
            status: 'active',
            current_period_ends_at: periodEnds.toISOString(),
            provider_subscription_id: `goat_${transactionId}`,
            price_at_time_of_subscription_cents: creator.subscription_price_cents,
            interval_at_time_of_subscription: creator.subscription_interval,
            payment_provider: 'goat',
          })
          .select()
          .single();
        if (!newSub) return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
        subId = newSub.id;
        try {
          const { data: subscriberProfile } = await supabaseAdmin
            .from('profiles')
            .select('username')
            .eq('id', userId)
            .single();
          if (subscriberProfile?.username) {
            await createNewSubscriptionNotification({
              creatorId,
              subscriberId: userId,
              subscriberUsername: subscriberProfile.username,
            });
          }
        } catch (_) {}
      }

      const { error: payInsertErr } = await supabaseAdmin.from('subscription_payments').insert({
        subscription_id: subId,
        user_id: userId,
        creator_profile_id: creatorId,
        amount_cents: paymentAmountCents,
        currency: 'USD',
        payment_provider: 'goat',
        status: 'succeeded',
        provider_transaction_reference: transactionId,
        provider_specific_details: providerDetails,
        period_starts_at: now.toISOString(),
        period_ends_at: periodEnds.toISOString(),
        creator_share_cents: creatorShare,
        platform_share_cents: platformShare,
        agency_share_cents: agencyShare > 0 ? agencyShare : null,
        agency_profile_id: agencyProfileId || null,
      });
      if (payInsertErr) {
        console.error('GOAT subscription_payments insert failed:', payInsertErr);
        return NextResponse.json({ error: 'Failed to record subscription payment' }, { status: 500 });
      }
      return NextResponse.json({ status: 'success', transaction_id: transactionId });
    }

    default:
      return NextResponse.json({ error: 'Unknown transaction type' }, { status: 400 });
  }
}
