import type { SupabaseClient } from '@supabase/supabase-js';
import { calculatePaymentSplits } from '@/lib/payments/calculate-splits';
import { calculatePaymentSplitsStore } from '@/lib/payments/calculate-splits-store';
import {
  createPPVPurchaseNotification,
  createTipNotification,
  createProductPurchaseNotification,
  createNewSubscriptionNotification,
} from '@/app/actions/notificationActions';
import {
  fulfillUsPaymateSession,
  type UsPaymatePaymentMetadata,
  type UsPaymateTransactionType,
} from '@/lib/payments/uspaymate';

export interface FinalizeUsPaymateOrderResult {
  ok: boolean;
  alreadyFulfilled?: boolean;
  error?: string;
}

async function isAlreadyFulfilled(
  supabase: SupabaseClient,
  transactionType: UsPaymateTransactionType,
  paymentIntentId: string
): Promise<boolean> {
  const tableByType: Partial<Record<UsPaymateTransactionType, string>> = {
    credit: 'credit_transactions',
    tip: 'tip_transactions',
    ppv: 'ppv_transactions',
    product: 'creator_product_transactions',
    subscription: 'subscription_payments',
  };
  const table = tableByType[transactionType];
  if (!table) return false;

  const { data } = await supabase
    .from(table)
    .select('id')
    .eq('provider_transaction_reference', paymentIntentId)
    .eq('payment_provider', 'uspaymate')
    .maybeSingle();

  return !!data;
}

export async function finalizeUsPaymateOrder(
  supabase: SupabaseClient,
  orderKey: string,
  paymentIntentId: string
): Promise<FinalizeUsPaymateOrderResult> {
  const { data: pending } = await supabase
    .from('pending_uspaymate_payments')
    .select('*')
    .eq('order_key', orderKey)
    .maybeSingle();

  if (!pending) {
    await fulfillUsPaymateSession(orderKey);
    return { ok: true, alreadyFulfilled: true };
  }

  const metadata = pending.metadata_json as UsPaymatePaymentMetadata;
  const transactionType = pending.transaction_type as UsPaymateTransactionType;

  if (await isAlreadyFulfilled(supabase, transactionType, paymentIntentId)) {
    await supabase.from('pending_uspaymate_payments').delete().eq('order_key', orderKey);
    await fulfillUsPaymateSession(orderKey);
    return { ok: true, alreadyFulfilled: true };
  }

  const providerDetails = {
    orderKey,
    paymentIntentId,
    transactionId: paymentIntentId,
    amount: metadata.amountCents / 100,
    currency: 'USD',
    status: 'paid',
  };

  const handlerResult = await runHandler(
    supabase,
    transactionType,
    metadata,
    paymentIntentId,
    providerDetails
  );

  if (!handlerResult.ok) {
    return handlerResult;
  }

  await supabase.from('pending_uspaymate_payments').delete().eq('order_key', orderKey);
  await fulfillUsPaymateSession(orderKey);
  return { ok: true };
}

async function runHandler(
  supabase: SupabaseClient,
  transactionType: UsPaymateTransactionType,
  metadata: UsPaymatePaymentMetadata,
  paymentIntentId: string,
  providerDetails: Record<string, unknown>
): Promise<FinalizeUsPaymateOrderResult> {
  const {
    userId,
    amountCents,
    postId,
    messageId,
    creatorId,
    productId,
    subscriptionId,
  } = metadata;

  switch (transactionType) {
    case 'credit': {
      const credits = metadata.credits;
      if (!credits) return { ok: false, error: 'Missing credits' };
      const { error: txErr } = await supabase.from('credit_transactions').insert({
        user_id: userId,
        amount_cents: amountCents,
        credits_purchased: parseInt(credits, 10),
        currency: 'USD',
        payment_provider: 'uspaymate',
        status: 'succeeded',
        provider_transaction_reference: paymentIntentId,
        provider_specific_details: providerDetails,
      });
      if (txErr) return { ok: false, error: 'Failed to create transaction' };
      const { data: profile } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', userId)
        .single();
      await supabase
        .from('profiles')
        .update({ credits: (profile?.credits || 0) + parseInt(credits, 10) })
        .eq('id', userId);
      return { ok: true };
    }

    case 'tip': {
      if (!creatorId) return { ok: false, error: 'Missing creatorId' };
      const { creatorShare, platformShare, agencyShare, agencyProfileId } =
        await calculatePaymentSplits(amountCents, creatorId);
      const { error: txErr } = await supabase.from('tip_transactions').insert({
        user_id: userId,
        post_id: postId || null,
        creator_id: creatorId,
        amount_cents: amountCents,
        currency: 'USD',
        payment_provider: 'uspaymate',
        status: 'succeeded',
        provider_transaction_reference: paymentIntentId,
        provider_specific_details: providerDetails,
        creator_share_cents: creatorShare,
        platform_share_cents: platformShare,
        agency_share_cents: agencyShare > 0 ? agencyShare : null,
        agency_profile_id: agencyProfileId || null,
      });
      if (txErr) return { ok: false, error: 'Failed to create transaction' };
      try {
        const { data: tipperProfile } = await supabase
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
        const { data: msg } = await supabase
          .from('messages')
          .select('sender_id')
          .eq('id', messageId)
          .single();
        if (!msg) return { ok: false, error: 'Message not found' };
        effectiveCreatorId = msg.sender_id;
      } else if (postId) {
        const { data: post } = await supabase
          .from('posts')
          .select('user_id')
          .eq('id', postId)
          .single();
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
        payment_provider: 'uspaymate',
        status: 'succeeded',
        provider_transaction_reference: paymentIntentId,
        provider_specific_details: providerDetails,
        creator_share_cents: creatorShare,
        platform_share_cents: platformShare,
        agency_share_cents: agencyShare > 0 ? agencyShare : null,
        agency_profile_id: agencyProfileId || null,
      };
      if (messageId) insertData.message_id = messageId;
      else insertData.post_id = postId;
      const { data: tx, error: txErr } = await supabase
        .from('ppv_transactions')
        .insert(insertData)
        .select()
        .single();
      if (txErr) return { ok: false, error: 'Failed to create transaction' };
      if (messageId) {
        await supabase.from('messages').update({ PPV_transaction_id: tx.id }).eq('id', messageId);
      }
      if (postId) {
        try {
          const { data: buyerProfile } = await supabase
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
      return { ok: true };
    }

    case 'product': {
      if (!productId) return { ok: false, error: 'Missing productId' };
      const { data: product } = await supabase
        .from('creator_products')
        .select('*')
        .eq('id', productId)
        .single();
      if (!product) return { ok: false, error: 'Product not found' };
      const { creatorShare, platformShare, agencyShare, agencyProfileId } =
        await calculatePaymentSplitsStore(amountCents, product.creator_profile_id);
      const { data: tx, error: txErr } = await supabase
        .from('creator_product_transactions')
        .insert({
          user_id: userId,
          creator_product_id: productId,
          amount_cents: amountCents,
          currency: 'USD',
          payment_provider: 'uspaymate',
          status: 'succeeded',
          provider_transaction_reference: paymentIntentId,
          provider_specific_details: providerDetails,
          creator_share_cents: creatorShare,
          platform_share_cents: platformShare,
          agency_share_cents: agencyShare > 0 ? agencyShare : null,
          agency_profile_id: agencyProfileId || null,
        })
        .select()
        .single();
      if (txErr) return { ok: false, error: 'Failed to create transaction' };
      await supabase.from('creator_product_orders').insert({
        creator_product_id: productId,
        user_id: userId,
        creator_product_transaction_id: tx.id,
        quantity: 1,
        order_status: 'paid',
      });
      try {
        const { data: buyerProfile } = await supabase
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
      return { ok: true };
    }

    case 'subscription': {
      if (!creatorId) return { ok: false, error: 'Missing creatorId' };
      const { data: creator } = await supabase
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
        const { error: subUpdateErr } = await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            current_period_ends_at: periodEnds.toISOString(),
            payment_provider: 'uspaymate',
            provider_subscription_id: `uspaymate_${paymentIntentId}`,
            price_at_time_of_subscription_cents: creator.subscription_price_cents,
            interval_at_time_of_subscription: creator.subscription_interval,
            canceled_at: null,
          })
          .eq('id', subscriptionId);
        if (subUpdateErr) return { ok: false, error: 'Failed to update subscription' };
        subId = subscriptionId;
      } else {
        const { data: newSub } = await supabase
          .from('subscriptions')
          .insert({
            follower_id: userId,
            following_id: creatorId,
            status: 'active',
            current_period_ends_at: periodEnds.toISOString(),
            provider_subscription_id: `uspaymate_${paymentIntentId}`,
            price_at_time_of_subscription_cents: creator.subscription_price_cents,
            interval_at_time_of_subscription: creator.subscription_interval,
            payment_provider: 'uspaymate',
          })
          .select()
          .single();
        if (!newSub) return { ok: false, error: 'Failed to create subscription' };
        subId = newSub.id;
        try {
          const { data: subscriberProfile } = await supabase
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

      const { error: payInsertErr } = await supabase.from('subscription_payments').insert({
        subscription_id: subId,
        user_id: userId,
        creator_profile_id: creatorId,
        amount_cents: paymentAmountCents,
        currency: 'USD',
        payment_provider: 'uspaymate',
        status: 'succeeded',
        provider_transaction_reference: paymentIntentId,
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
