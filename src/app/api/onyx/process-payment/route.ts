import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { processOnyxPayment, type OnyxPaymentMetadata, type OnyxCardInput, type OnyxBillingInput, type OnyxTransactionType } from '@/lib/payments/onyx';
import { encryptCardNumber, decryptCardNumber } from '@/lib/payments/card-encryption';
import { calculatePaymentSplits } from '@/lib/payments/calculate-splits';
import { calculatePaymentSplitsStore } from '@/lib/payments/calculate-splits-store';
import { createPPVPurchaseNotification, createTipNotification, createProductPurchaseNotification, createNewSubscriptionNotification } from '@/app/actions/notificationActions';

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

function cardBrandFromNumber(number: string): string | null {
  const n = (number || '').replace(/\s/g, '');
  if (/^4/.test(n)) return 'visa';
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return 'mastercard';
  if (/^3[47]/.test(n)) return 'amex';
  if (/^6(?:011|5)/.test(n)) return 'discover';
  return null;
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
      save_card,
      payment_method_id,
      returnUrl,
    } = body as {
      transactionType: OnyxTransactionType;
      amountCents: number;
      metadata: OnyxPaymentMetadata;
      card?: OnyxCardInput;
      billing?: OnyxBillingInput;
      save_card?: boolean;
      payment_method_id?: string;
      returnUrl?: string;
    };

    if (!transactionType || !amountCents || !metadata?.userId) {
      return NextResponse.json({ error: 'Missing transactionType, amountCents, or metadata.userId' }, { status: 400 });
    }
    if (amountCents <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }
    if (metadata.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!payment_method_id && (!card?.number || !card?.exp_month || !card?.exp_year || !card?.cvc)) {
      return NextResponse.json({ error: 'Card details or payment_method_id required' }, { status: 400 });
    }

    // Build billing: use request or placeholder (Onyx requires non-empty fields). We do not charge saved cards via token (Onyx doesn't return one).
    const placeholderBilling = {
      first_name: 'Customer',
      last_name: 'User',
      email: '',
      phone_number: '1',
      address: 'N/A',
      city: 'N/A',
      state: 'N/A',
      zip: '00000',
    };
    let effectiveBilling: typeof billing = billing;
    const hasBilling = effectiveBilling?.phone_number?.trim() && effectiveBilling?.address?.trim() && effectiveBilling?.city?.trim() && effectiveBilling?.state?.trim() && effectiveBilling?.zip?.trim();
    if (!hasBilling) {
      effectiveBilling = { ...placeholderBilling, ...effectiveBilling };
    }
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://blabber.ai';
    const redirectUrl = returnUrl ? `${baseUrl}/onyx-callback?returnUrl=${encodeURIComponent(returnUrl)}` : `${baseUrl}/onyx-callback`;

    let cardToUse = card;
    let billingToUse = effectiveBilling;
    // Charge saved card: load encrypted number, decrypt, and send to Onyx (no CVV for recurring).
    if (payment_method_id && payment_method_id.startsWith('local-') && !card?.number) {
      const { data: pm } = await supabaseAdmin
        .from('user_payment_methods')
        .select('encrypted_card_number, exp_month, exp_year, billing_phone_number, billing_address, billing_city, billing_state, billing_zip, billing_first_name, billing_last_name, billing_email')
        .eq('user_id', user.id)
        .eq('onyx_payment_method_id', payment_method_id)
        .maybeSingle();
      if (!pm?.encrypted_card_number || pm.exp_month == null || pm.exp_year == null) {
        return NextResponse.json({ error: 'Saved card not found or missing details.' }, { status: 400 });
      }
      try {
        const number = decryptCardNumber(pm.encrypted_card_number);
        const expMonth = String(pm.exp_month).padStart(2, '0');
        const expYear = String(pm.exp_year).length === 2 ? pm.exp_year : String(pm.exp_year).slice(-2);
        cardToUse = { number, exp_month: expMonth, exp_year: expYear, cvc: '' };
        if (pm.billing_phone_number && pm.billing_address && pm.billing_city && pm.billing_state && pm.billing_zip) {
          billingToUse = {
            first_name: pm.billing_first_name ?? 'Customer',
            last_name: pm.billing_last_name ?? 'User',
            email: pm.billing_email ?? '',
            phone_number: pm.billing_phone_number,
            address: pm.billing_address,
            city: pm.billing_city,
            state: pm.billing_state,
            zip: pm.billing_zip,
          };
        }
      } catch (err) {
        console.error('Decrypt saved card error:', err);
        return NextResponse.json({ error: 'Could not use saved card.' }, { status: 400 });
      }
    } else if (payment_method_id && !payment_method_id.startsWith('local-')) {
      return NextResponse.json({ error: 'Invalid payment method.' }, { status: 400 });
    }

    if (!cardToUse?.number || !cardToUse?.exp_month || !cardToUse?.exp_year) {
      return NextResponse.json({ error: 'Card details or saved card required' }, { status: 400 });
    }

    const result = await processOnyxPayment({
      amountCents,
      currency: 'USD',
      metadata,
      card: cardToUse,
      billing: billingToUse,
      save_card: !!save_card,
      payment_method_id: undefined,
      redirect_url: redirectUrl,
      customer_ip: getClientIp(request),
    });

    if (result.status === 'REDIRECT' && result.redirect_url && result.transaction_id) {
      await supabaseAdmin.from('pending_onyx_payments').insert({
        transaction_id: result.transaction_id,
        user_id: user.id,
        transaction_type: transactionType,
        metadata_json: metadata,
      });
      return NextResponse.json({
        status: 'redirect',
        redirect_url: result.redirect_url,
        transaction_id: result.transaction_id,
      });
    }

    if (result.status === 'SUCCESS' && result.transaction_id) {
      const providerDetails = {
        transactionId: result.transaction_id,
        amount: amountCents / 100,
        currency: 'USD',
        status: 'SUCCESS',
      };
      const res = await runHandler(transactionType, metadata, result.transaction_id, providerDetails);
      // Save card on our side (encrypted) for subscription rebills
      let savedCardError: string | null = null;
      if (res.status === 200 && save_card && card?.number && effectiveBilling) {
        try {
          const { randomUUID } = await import('crypto');
          const rawNumber = card.number.replace(/\s/g, '');
          const last4 = rawNumber.slice(-4);
          const brand = cardBrandFromNumber(rawNumber);
          const expMonth = card.exp_month?.replace(/\D/g, '').slice(0, 2);
          const expYear = card.exp_year?.length === 2 ? parseInt(`20${card.exp_year}`, 10) : parseInt(card.exp_year || '0', 10);
          const { data: existing } = await supabaseAdmin.from('user_payment_methods').select('id').eq('user_id', user.id).limit(1).maybeSingle();
          const localId = `local-${randomUUID()}`;
          let encryptedCard: string | null = null;
          try {
            encryptedCard = encryptCardNumber(rawNumber);
          } catch (keyErr) {
            const msg = keyErr instanceof Error ? keyErr.message : String(keyErr);
            console.error('CARD_ENCRYPTION_KEY not set or invalid:', msg);
            savedCardError = 'Card could not be saved for future use (encryption not configured).';
          }
          if (!savedCardError) {
            const { error: insertErr } = await supabaseAdmin.from('user_payment_methods').insert({
              user_id: user.id,
              onyx_payment_method_id: localId,
              last4,
              brand,
              exp_month: expMonth ? parseInt(expMonth, 10) : null,
              exp_year: expYear || null,
              is_default: !existing,
              encrypted_card_number: encryptedCard,
              billing_phone_number: effectiveBilling.phone_number?.trim() ?? null,
              billing_address: effectiveBilling.address?.trim() ?? null,
              billing_city: effectiveBilling.city?.trim() ?? null,
              billing_state: effectiveBilling.state?.trim() ?? null,
              billing_zip: effectiveBilling.zip?.trim() ?? null,
              billing_first_name: effectiveBilling.first_name?.trim() ?? null,
              billing_last_name: effectiveBilling.last_name?.trim() ?? null,
              billing_email: effectiveBilling.email?.trim() ?? null,
            });
            if (insertErr) {
              console.error('Save payment method failed:', insertErr.message, insertErr.details);
              savedCardError = insertErr.message;
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('Save payment method error:', msg);
          savedCardError = msg;
        }
      }
      if (savedCardError && res.status === 200) {
        const body = await res.clone().json().catch(() => ({}));
        return NextResponse.json({ ...body, saved_card_error: savedCardError }, { status: 200 });
      }
      return res;
    }

    return NextResponse.json(
      { error: result.message || 'Payment failed' },
      { status: 400 }
    );
  } catch (err) {
    console.error('Onyx process-payment error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function runHandler(
  transactionType: OnyxTransactionType,
  metadata: OnyxPaymentMetadata,
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
        payment_provider: 'onyx',
        status: 'succeeded',
        provider_transaction_reference: transactionId,
        provider_specific_details: providerDetails,
      });
      if (txErr) return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
      const { data: profile } = await supabaseAdmin.from('profiles').select('credits').eq('id', userId).single();
      await supabaseAdmin.from('profiles').update({ credits: (profile?.credits || 0) + parseInt(credits) }).eq('id', userId);
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
        payment_provider: 'onyx',
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
        const { data: tipperProfile } = await supabaseAdmin.from('profiles').select('username').eq('id', userId).single();
        if (tipperProfile?.username) {
          await createTipNotification({ creatorId, tipperId: userId, tipperUsername: tipperProfile.username, amount: amountCents / 100, postId });
        }
      } catch (_) {}
      return NextResponse.json({ status: 'success', transaction_id: transactionId });
    }

    case 'ppv': {
      let effectiveCreatorId: string;
      if (messageId) {
        const { data: msg } = await supabaseAdmin.from('messages').select('sender_id').eq('id', messageId).single();
        if (!msg) return NextResponse.json({ error: 'Message not found' }, { status: 404 });
        effectiveCreatorId = msg.sender_id;
      } else if (postId) {
        const { data: post } = await supabaseAdmin.from('posts').select('user_id').eq('id', postId).single();
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
        payment_provider: 'onyx',
        status: 'succeeded',
        provider_transaction_reference: transactionId,
        provider_specific_details: providerDetails,
        creator_share_cents: creatorShare,
        platform_share_cents: platformShare,
        agency_share_cents: agencyShare > 0 ? agencyShare : null,
        agency_profile_id: agencyProfileId || null,
      };
      if (messageId) (insertData as any).message_id = messageId; else (insertData as any).post_id = postId;
      const { data: tx, error: txErr } = await supabaseAdmin.from('ppv_transactions').insert(insertData).select().single();
      if (txErr) return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
      if (messageId) {
        await supabaseAdmin.from('messages').update({ PPV_transaction_id: tx.id }).eq('id', messageId);
      }
      if (postId) {
        try {
          const { data: buyerProfile } = await supabaseAdmin.from('profiles').select('username').eq('id', userId).single();
          if (buyerProfile?.username) {
            await createPPVPurchaseNotification({ creatorId: effectiveCreatorId, buyerId: userId, buyerUsername: buyerProfile.username, postId, amount: amountCents / 100 });
          }
        } catch (_) {}
      }
      return NextResponse.json({ status: 'success', transaction_id: transactionId });
    }

    case 'product': {
      if (!productId) return NextResponse.json({ error: 'Missing productId' }, { status: 400 });
      const { data: product } = await supabaseAdmin.from('creator_products').select('*').eq('id', productId).single();
      if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      const { creatorShare, platformShare, agencyShare, agencyProfileId } =
        await calculatePaymentSplitsStore(amountCents, product.creator_profile_id);
      const { data: tx, error: txErr } = await supabaseAdmin.from('creator_product_transactions').insert({
        user_id: userId,
        creator_product_id: productId,
        amount_cents: amountCents,
        currency: 'USD',
        payment_provider: 'onyx',
        status: 'succeeded',
        provider_transaction_reference: transactionId,
        provider_specific_details: providerDetails,
        creator_share_cents: creatorShare,
        platform_share_cents: platformShare,
        agency_share_cents: agencyShare > 0 ? agencyShare : null,
        agency_profile_id: agencyProfileId || null,
      }).select().single();
      if (txErr) return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
      await supabaseAdmin.from('creator_product_orders').insert({
        creator_product_id: productId,
        user_id: userId,
        creator_product_transaction_id: tx.id,
        quantity: 1,
        order_status: 'paid',
      });
      try {
        const { data: buyerProfile } = await supabaseAdmin.from('profiles').select('username').eq('id', userId).single();
        if (buyerProfile?.username) {
          await createProductPurchaseNotification({ creatorId: product.creator_profile_id, buyerId: userId, buyerUsername: buyerProfile.username, productName: product.product_name, amount: amountCents / 100 });
        }
      } catch (_) {}
      return NextResponse.json({ status: 'success', transaction_id: transactionId });
    }

    case 'subscription': {
      if (!creatorId) return NextResponse.json({ error: 'Missing creatorId' }, { status: 400 });
      const { data: creator } = await supabaseAdmin.from('creators').select('subscription_price_cents, subscription_interval').eq('profile_id', creatorId).single();
      if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
      // Use creator's current price for the payment record (resubscribe may have different price than when they cancelled)
      const paymentAmountCents = creator.subscription_price_cents ?? amountCents;
      const { creatorShare, platformShare, agencyShare, agencyProfileId } =
        await calculatePaymentSplits(paymentAmountCents, creatorId);
      const now = new Date();
      const periodEnds = new Date(now);
      if (creator.subscription_interval === 'month') periodEnds.setMonth(periodEnds.getMonth() + 1);
      else periodEnds.setFullYear(periodEnds.getFullYear() + 1);

      let subId: string;
      if (subscriptionId) {
        // Resubscribe: update subscription with current price/interval before recording payment
        const { error: subUpdateErr } = await supabaseAdmin.from('subscriptions').update({
          status: 'active',
          current_period_ends_at: periodEnds.toISOString(),
          payment_provider: 'onyx',
          provider_subscription_id: `onyx_${transactionId}`,
          price_at_time_of_subscription_cents: creator.subscription_price_cents,
          interval_at_time_of_subscription: creator.subscription_interval,
          canceled_at: null,
        }).eq('id', subscriptionId);
        if (subUpdateErr) {
          console.error('Onyx subscription update failed:', subUpdateErr);
          return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
        }
        subId = subscriptionId;
      } else {
        const { data: newSub } = await supabaseAdmin.from('subscriptions').insert({
          follower_id: userId,
          following_id: creatorId,
          status: 'active',
          current_period_ends_at: periodEnds.toISOString(),
          provider_subscription_id: `onyx_${transactionId}`,
          price_at_time_of_subscription_cents: creator.subscription_price_cents,
          interval_at_time_of_subscription: creator.subscription_interval,
          payment_provider: 'onyx',
        }).select().single();
        if (!newSub) return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
        subId = newSub.id;
        try {
          const { data: subscriberProfile } = await supabaseAdmin.from('profiles').select('username').eq('id', userId).single();
          if (subscriberProfile?.username) {
            await createNewSubscriptionNotification({ creatorId, subscriberId: userId, subscriberUsername: subscriberProfile.username });
          }
        } catch (_) {}
      }

      const { error: payInsertErr } = await supabaseAdmin.from('subscription_payments').insert({
        subscription_id: subId,
        user_id: userId,
        creator_profile_id: creatorId,
        amount_cents: paymentAmountCents,
        currency: 'USD',
        payment_provider: 'onyx',
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
        console.error('Onyx subscription_payments insert failed:', payInsertErr);
        return NextResponse.json({ error: 'Failed to record subscription payment' }, { status: 500 });
      }
      return NextResponse.json({ status: 'success', transaction_id: transactionId });
    }

    default:
      return NextResponse.json({ error: 'Unknown transaction type' }, { status: 400 });
  }
}
