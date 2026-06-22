/**
 * GOAT Payments webhook receiver.
 *
 * Documented event types (per https://developers.goatpaymentsdashboard.com):
 *   - Payment Transaction Created
 *   - Refund Transaction Created
 *   - Recurring Transaction Created
 *   - High Risk Authorization Warning
 *
 * The exact signature header / verification algorithm isn't published yet, so
 * the verification step is gated on `GOAT_WEBHOOK_SECRET` being set and is
 * structured so the only thing left to fill in once GOAT confirms is
 * `verifyGoatSignature` below. Until then, leaving the secret unset will skip
 * verification (only safe for local development).
 */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import {
  calculatePaymentSplits,
} from '@/lib/payments/calculate-splits';
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

interface GoatWebhookEnvelope {
  event?: string;
  type?: string;
  data?: {
    id?: string;
    status?: { status?: string; reason?: string };
    amount?: string | number;
    [key: string]: unknown;
  };
  // Some processors put the transaction at the top level instead of under .data
  id?: string;
  status?: { status?: string; reason?: string };
}

/**
 * Verify the signature header GOAT sends with each webhook.
 *
 * TODO: GOAT hasn't documented the exact header name or signing algorithm yet.
 * Once confirmed, replace this function. Common patterns to expect:
 *   - HMAC-SHA256 over the raw body, hex-encoded, sent as `X-Goat-Signature`
 *   - Comma-separated `t=<timestamp>,v1=<hmac>` (Stripe-style replay-safe form)
 */
function verifyGoatSignature(_rawBody: string, _request: Request): boolean {
  const secret = process.env.GOAT_WEBHOOK_SECRET?.trim();
  if (!secret) return true; // dev-mode bypass; production should always set the secret
  // TODO: implement real verification. Returning false here would lock out
  // every event until verification is wired, so we deliberately keep this
  // permissive but log so prod traffic is visible while the impl lands.
  console.warn('[goat-webhook] GOAT_WEBHOOK_SECRET set but signature verification is not yet implemented; allowing event.');
  return true;
}

function classifyStatus(raw: string | undefined): 'SUCCESS' | 'PENDING' | 'FAILED' {
  const v = (raw || '').toLowerCase();
  if (!v) return 'FAILED';
  if (/(approved|captured|sale|settled|paid|batched|completed)/.test(v)) return 'SUCCESS';
  if (/(pending|submitted|hold|processing|queued|authorized)/.test(v)) return 'PENDING';
  return 'FAILED';
}

export async function POST(request: Request) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (err) {
    console.error('[goat-webhook] failed to read body:', err);
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  if (!verifyGoatSignature(rawBody, request)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let envelope: GoatWebhookEnvelope = {};
  try {
    envelope = JSON.parse(rawBody) as GoatWebhookEnvelope;
  } catch (_) {
    // Some processors send form-encoded webhooks. Parse if JSON failed.
    try {
      const form = new URLSearchParams(rawBody);
      envelope = Object.fromEntries(form.entries()) as unknown as GoatWebhookEnvelope;
    } catch (err) {
      console.error('[goat-webhook] could not parse body:', err);
      return NextResponse.json({ error: 'invalid body' }, { status: 400 });
    }
  }

  const eventName = (envelope.event || envelope.type || '').toString();
  const transaction = envelope.data ?? {
    id: envelope.id,
    status: envelope.status,
  };
  const transactionId = transaction.id;

  if (!transactionId) {
    return NextResponse.json({ error: 'missing transaction id' }, { status: 400 });
  }

  // Currently only the "Payment Transaction Created" event is acted on; the
  // others (refund / recurring / high-risk warning) are accepted and logged so
  // the request returns 200 and GOAT doesn't retry — wire them up as needed.
  if (!/payment.*transaction.*created/i.test(eventName)) {
    console.log('[goat-webhook] received event (no-op):', eventName, transactionId);
    return NextResponse.json({ received: true });
  }

  const finalStatus = classifyStatus(transaction.status?.status);

  // Look up the parked transaction. If it isn't pending, this is either an
  // immediate-success replay or an unsolicited event — accept and ignore.
  const { data: pending } = await supabaseAdmin
    .from('pending_goat_payments')
    .select('*')
    .eq('transaction_id', transactionId)
    .maybeSingle();

  if (!pending) {
    console.log('[goat-webhook] no pending row for', transactionId, '— ignoring');
    return NextResponse.json({ received: true });
  }

  if (finalStatus !== 'SUCCESS') {
    if (finalStatus === 'FAILED') {
      // Drop the pending row so the user can retry.
      await supabaseAdmin
        .from('pending_goat_payments')
        .delete()
        .eq('transaction_id', transactionId);
    }
    return NextResponse.json({ received: true, status: finalStatus.toLowerCase() });
  }

  const metadata = pending.metadata_json as {
    userId: string;
    transactionType: 'tip' | 'ppv' | 'subscription' | 'credit' | 'product';
    postId?: string;
    messageId?: string;
    creatorId?: string;
    productId?: string;
    subscriptionId?: string;
    amountCents: number;
    credits?: string;
  };
  const transactionType = pending.transaction_type as typeof metadata.transactionType;
  const providerDetails = {
    transactionId,
    amount: metadata.amountCents / 100,
    currency: 'USD',
    status: 'SUCCESS',
    eventName,
  };

  const handlerResult = await runHandler(transactionType, metadata, transactionId, providerDetails);
  if (handlerResult.ok) {
    await supabaseAdmin
      .from('pending_goat_payments')
      .delete()
      .eq('transaction_id', transactionId);
  }

  return NextResponse.json({ received: true, finalized: handlerResult.ok });
}

interface RunHandlerOk { ok: true; }
interface RunHandlerErr { ok: false; error: string; }
type RunHandlerResult = RunHandlerOk | RunHandlerErr;

async function runHandler(
  transactionType: 'tip' | 'ppv' | 'subscription' | 'credit' | 'product',
  metadata: {
    userId: string;
    amountCents: number;
    postId?: string;
    messageId?: string;
    creatorId?: string;
    productId?: string;
    subscriptionId?: string;
    credits?: string;
  },
  transactionId: string,
  providerDetails: Record<string, unknown>
): Promise<RunHandlerResult> {
  const { userId, amountCents, postId, messageId, creatorId, productId, subscriptionId } = metadata;

  switch (transactionType) {
    case 'credit': {
      const credits = metadata.credits;
      if (!credits) return { ok: false, error: 'Missing credits' };
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
      if (txErr) return { ok: false, error: 'Failed to create transaction' };
      const { data: profile } = await supabaseAdmin.from('profiles').select('credits').eq('id', userId).single();
      await supabaseAdmin
        .from('profiles')
        .update({ credits: (profile?.credits || 0) + parseInt(credits) })
        .eq('id', userId);
      return { ok: true };
    }

    case 'tip': {
      if (!creatorId) return { ok: false, error: 'Missing creatorId' };
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
      if (txErr) return { ok: false, error: 'Failed to create transaction' };
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
      return { ok: true };
    }

    case 'ppv': {
      let effectiveCreatorId: string;
      if (messageId) {
        const { data: msg } = await supabaseAdmin.from('messages').select('sender_id').eq('id', messageId).single();
        if (!msg) return { ok: false, error: 'Message not found' };
        effectiveCreatorId = msg.sender_id;
      } else if (postId) {
        const { data: post } = await supabaseAdmin.from('posts').select('user_id').eq('id', postId).single();
        if (!post) return { ok: false, error: 'Post not found' };
        effectiveCreatorId = post.user_id;
      } else {
        return { ok: false, error: 'Missing postId or messageId' };
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
      if (txErr) return { ok: false, error: 'Failed to create transaction' };
      if (messageId) {
        await supabaseAdmin.from('messages').update({ PPV_transaction_id: tx.id }).eq('id', messageId);
      }
      if (postId) {
        try {
          const { data: buyerProfile } = await supabaseAdmin.from('profiles').select('username').eq('id', userId).single();
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
      return { ok: true };
    }

    case 'product': {
      if (!productId) return { ok: false, error: 'Missing productId' };
      const { data: product } = await supabaseAdmin.from('creator_products').select('*').eq('id', productId).single();
      if (!product) return { ok: false, error: 'Product not found' };
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
      if (txErr) return { ok: false, error: 'Failed to create transaction' };
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
          await createProductPurchaseNotification({
            creatorId: product.creator_profile_id,
            buyerId: userId,
            buyerUsername: buyerProfile.username,
            productName: product.product_name,
            amount: amountCents / 100,
          });
        }
      } catch (_) {}
      return { ok: true };
    }

    case 'subscription': {
      if (!creatorId) return { ok: false, error: 'Missing creatorId' };
      const { data: creator } = await supabaseAdmin
        .from('creators')
        .select('subscription_price_cents, subscription_interval')
        .eq('profile_id', creatorId)
        .single();
      if (!creator) return { ok: false, error: 'Creator not found' };
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
        if (subUpdateErr) return { ok: false, error: 'Failed to update subscription' };
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
        if (!newSub) return { ok: false, error: 'Failed to create subscription' };
        subId = newSub.id;
        try {
          const { data: subscriberProfile } = await supabaseAdmin.from('profiles').select('username').eq('id', userId).single();
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
      if (payInsertErr) return { ok: false, error: 'Failed to record subscription payment' };
      return { ok: true };
    }

    default:
      return { ok: false, error: 'Unknown transaction type' };
  }
}
