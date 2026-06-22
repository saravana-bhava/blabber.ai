import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  getCreditOnlyMonetizationSettings,
  usdCentsToCreditsRequired,
} from '@/lib/payments/credit-only-settings';
import {
  calculatePaymentSplitsContentServer,
  calculatePaymentSplitsStoreServer,
} from '@/lib/payments/calculate-splits-server';
import {
  createPPVPurchaseNotification,
  createTipNotification,
  createProductPurchaseNotification,
  createNewSubscriptionNotification,
} from '@/app/actions/notificationActions';

import type { CreditSpendRequest } from '@/lib/payments/credit-spend-types';

export type CreditSpendBody = CreditSpendRequest;

export type CreditSpendResult =
  | { ok: true; creditsCharged: number }
  | { ok: false; status: number; error: string; code?: string };

function uniqueCreditRef(): string {
  return `credit_${crypto.randomUUID()}`;
}

async function debitOrFail(
  admin: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  credits: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await admin.rpc('debit_credits_if_sufficient', {
    p_user_id: userId,
    p_credits: credits,
  });
  if (error) {
    console.error('debit_credits_if_sufficient rpc error', error);
    return { ok: false, error: 'Could not process credits' };
  }
  const row = data as { ok?: boolean; error?: string } | null;
  if (!row?.ok) {
    if (row?.error === 'insufficient_credits') {
      return { ok: false, error: 'insufficient_credits' };
    }
    return { ok: false, error: row?.error || 'debit_failed' };
  }
  return { ok: true };
}

async function refundSafe(
  admin: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  credits: number
) {
  if (credits < 1) return;
  await admin.rpc('refund_credits', { p_user_id: userId, p_credits: credits });
}

export async function executeCreditSpendPurchase(
  userId: string,
  body: CreditSpendBody
): Promise<CreditSpendResult> {
  const settings = await getCreditOnlyMonetizationSettings();
  if (!settings.creditOnlyEcosystem) {
    return { ok: false, status: 403, error: 'Credit-only purchases are not enabled' };
  }

  const admin = createServiceRoleClient();
  const pricePerCredit = settings.pricePerCreditCents;

  const run = async (amountCents: number, fn: () => Promise<void>): Promise<CreditSpendResult> => {
    const credits = usdCentsToCreditsRequired(amountCents, pricePerCredit);
    const d = await debitOrFail(admin, userId, credits);
    if (!d.ok) {
      if (d.error === 'insufficient_credits') {
        return {
          ok: false,
          status: 402,
          error: 'Insufficient credits',
          code: 'INSUFFICIENT_CREDITS',
        };
      }
      return { ok: false, status: 400, error: d.error };
    }
    try {
      await fn();
    } catch (e) {
      console.error('credit spend post-debit failure', e);
      await refundSafe(admin, userId, credits);
      return {
        ok: false,
        status: 500,
        error: 'Purchase failed; your credits were refunded.',
      };
    }
    return { ok: true, creditsCharged: credits };
  };

  try {
    switch (body.kind) {
      case 'ppv': {
        if (body.postId) {
          const { data: existing } = await admin
            .from('ppv_transactions')
            .select('id')
            .eq('user_id', userId)
            .eq('post_id', body.postId)
            .eq('status', 'succeeded')
            .maybeSingle();
          if (existing) {
            return { ok: false, status: 400, error: 'You have already purchased this content' };
          }
          const { data: post, error: pe } = await admin
            .from('posts')
            .select('ppv_price_cents, user_id')
            .eq('id', body.postId)
            .single();
          if (pe || !post) return { ok: false, status: 404, error: 'Post not found' };
          const { data: postCreator } = await admin
            .from('creators')
            .select('can_monetize')
            .eq('profile_id', post.user_id)
            .maybeSingle();
          if (!postCreator?.can_monetize) return { ok: false, status: 403, error: 'Creator is not accepting payments' };
          const amountCents = post.ppv_price_cents;
          return run(amountCents, async () => {
            const ref = uniqueCreditRef();
            const splits = await calculatePaymentSplitsContentServer(amountCents, post.user_id);
            const { error: ins } = await admin.from('ppv_transactions').insert({
              user_id: userId,
              post_id: body.postId,
              amount_cents: amountCents,
              payment_intent_id: ref,
              status: 'succeeded',
              payment_provider: 'credits',
              provider_transaction_reference: ref,
              creator_share_cents: splits.creatorShare,
              platform_share_cents: splits.platformShare,
              agency_share_cents: splits.agencyShare > 0 ? splits.agencyShare : null,
              agency_profile_id: splits.agencyProfileId || null,
            });
            if (ins) throw ins;
            const { data: buyerProfile } = await admin
              .from('profiles')
              .select('username')
              .eq('id', userId)
              .single();
            if (buyerProfile?.username) {
              await createPPVPurchaseNotification({
                creatorId: post.user_id,
                buyerId: userId,
                buyerUsername: buyerProfile.username,
                postId: body.postId!,
                amount: amountCents / 100,
              });
            }
          });
        }
        if (body.messageId) {
          const { data: existing } = await admin
            .from('ppv_transactions')
            .select('id')
            .eq('user_id', userId)
            .eq('message_id', body.messageId)
            .eq('status', 'succeeded')
            .maybeSingle();
          if (existing) {
            return { ok: false, status: 400, error: 'You have already purchased this content' };
          }
          const { data: msg, error: me } = await admin
            .from('messages')
            .select('id, PPV_price, sender_id')
            .eq('id', body.messageId)
            .single();
          if (me || !msg || !msg.PPV_price) {
            return { ok: false, status: 404, error: 'Message not found' };
          }
          const amountCents = msg.PPV_price;
          return run(amountCents, async () => {
            const ref = uniqueCreditRef();
            const splits = await calculatePaymentSplitsContentServer(amountCents, msg.sender_id);
            const { data: tx, error: ins } = await admin
              .from('ppv_transactions')
              .insert({
                user_id: userId,
                message_id: body.messageId,
                amount_cents: amountCents,
                payment_intent_id: ref,
                status: 'succeeded',
                payment_provider: 'credits',
                provider_transaction_reference: ref,
                creator_share_cents: splits.creatorShare,
                platform_share_cents: splits.platformShare,
                agency_share_cents: splits.agencyShare > 0 ? splits.agencyShare : null,
                agency_profile_id: splits.agencyProfileId || null,
              })
              .select('id')
              .single();
            if (ins || !tx) throw ins;
            await admin
              .from('messages')
              .update({ PPV_transaction_id: tx.id })
              .eq('id', msg.id)
              .eq('sender_id', msg.sender_id);
          });
        }
        return { ok: false, status: 400, error: 'postId or messageId required' };
      }

      case 'tip': {
        const { amountCents, postId, creatorId } = body;
        if (!amountCents || amountCents < 100) {
          return { ok: false, status: 400, error: 'Invalid tip amount' };
        }
        let effectiveCreator: string | null = creatorId || null;
        if (postId && !effectiveCreator) {
          const { data: post } = await admin.from('posts').select('user_id').eq('id', postId).single();
          effectiveCreator = post?.user_id || null;
        }
        if (!effectiveCreator) return { ok: false, status: 400, error: 'Creator required' };
        return run(amountCents, async () => {
          const ref = uniqueCreditRef();
          const splits = await calculatePaymentSplitsContentServer(amountCents, effectiveCreator);
          const { error: ins } = await admin.from('tip_transactions').insert({
            user_id: userId,
            post_id: postId || null,
            creator_id: effectiveCreator,
            amount_cents: amountCents,
            payment_intent_id: ref,
            status: 'succeeded',
            payment_provider: 'credits',
            provider_transaction_reference: ref,
            creator_share_cents: splits.creatorShare,
            platform_share_cents: splits.platformShare,
            agency_share_cents: splits.agencyShare > 0 ? splits.agencyShare : null,
            agency_profile_id: splits.agencyProfileId || null,
          });
          if (ins) throw ins;
          const { data: tipperProfile } = await admin
            .from('profiles')
            .select('username')
            .eq('id', userId)
            .single();
          if (tipperProfile?.username) {
            await createTipNotification({
              creatorId: effectiveCreator!,
              tipperId: userId,
              tipperUsername: tipperProfile.username,
              amount: amountCents / 100,
              postId: postId || undefined,
            });
          }
        });
      }

      case 'subscription': {
        const { creatorId, subscriptionId } = body;
        if (!creatorId) return { ok: false, status: 400, error: 'creatorId required' };
        const { data: creator, error: ce } = await admin
          .from('creators')
          .select('subscription_price_cents, subscription_interval, can_monetize')
          .eq('profile_id', creatorId)
          .single();
        if (ce || !creator) return { ok: false, status: 404, error: 'Creator not found' };
        if (!creator.can_monetize) return { ok: false, status: 403, error: 'Creator is not accepting payments' };
        const paymentAmountCents = creator.subscription_price_cents ?? 0;
        if (paymentAmountCents <= 0) {
          return { ok: false, status: 400, error: 'Invalid subscription price' };
        }

        return run(paymentAmountCents, async () => {
          const ref = uniqueCreditRef();
          const splits = await calculatePaymentSplitsContentServer(paymentAmountCents, creatorId);
          const now = new Date();
          const periodEnds = new Date(now);
          if (creator.subscription_interval === 'month') {
            periodEnds.setMonth(periodEnds.getMonth() + 1);
          } else {
            periodEnds.setFullYear(periodEnds.getFullYear() + 1);
          }

          let subId: string;
          let createdNewSubscription = false;
          if (subscriptionId) {
            subId = subscriptionId;
          } else {
            const { data: newSub, error: subErr } = await admin
              .from('subscriptions')
              .insert({
                follower_id: userId,
                following_id: creatorId,
                status: 'active',
                current_period_ends_at: periodEnds.toISOString(),
                provider_subscription_id: ref,
                price_at_time_of_subscription_cents: creator.subscription_price_cents,
                interval_at_time_of_subscription: creator.subscription_interval,
                payment_provider: 'credits',
              })
              .select()
              .single();
            if (subErr || !newSub) throw subErr;
            subId = newSub.id;
            createdNewSubscription = true;
          }

          const { error: payInsertErr } = await admin.from('subscription_payments').insert({
            subscription_id: subId,
            user_id: userId,
            creator_profile_id: creatorId,
            amount_cents: paymentAmountCents,
            currency: 'USD',
            payment_provider: 'credits',
            status: 'succeeded',
            payment_intent_id: ref,
            provider_transaction_reference: ref,
            period_starts_at: now.toISOString(),
            period_ends_at: periodEnds.toISOString(),
            creator_share_cents: splits.creatorShare,
            platform_share_cents: splits.platformShare,
            agency_share_cents: splits.agencyShare > 0 ? splits.agencyShare : null,
            agency_profile_id: splits.agencyProfileId || null,
          });
          if (payInsertErr) {
            if (createdNewSubscription) {
              await admin.from('subscriptions').delete().eq('id', subId);
            }
            throw payInsertErr;
          }

          if (subscriptionId) {
            const { error: subUpdateErr } = await admin
              .from('subscriptions')
              .update({
                status: 'active',
                current_period_ends_at: periodEnds.toISOString(),
                payment_provider: 'credits',
                provider_subscription_id: ref,
                price_at_time_of_subscription_cents: creator.subscription_price_cents,
                interval_at_time_of_subscription: creator.subscription_interval,
                canceled_at: null,
              })
              .eq('id', subscriptionId);
            if (subUpdateErr) {
              await admin.from('subscription_payments').delete().eq('payment_intent_id', ref);
              throw subUpdateErr;
            }
          }

          try {
            const { data: subscriberProfile } = await admin
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
          } catch {
            /* notification best-effort */
          }
        });
      }

      case 'product': {
        const { productId, amountCents, shippingAddress } = body;
        const { data: product, error: perr } = await admin
          .from('creator_products')
          .select('*')
          .eq('id', productId)
          .eq('is_active', true)
          .single();
        if (perr || !product) return { ok: false, status: 404, error: 'Product not found' };
        const expected = product.price_cents + (product.shipping_price_cents || 0);
        if (amountCents !== expected) {
          return { ok: false, status: 400, error: 'Amount does not match product price' };
        }
        return run(amountCents, async () => {
          const ref = uniqueCreditRef();
          const splits = await calculatePaymentSplitsStoreServer(amountCents, product.creator_profile_id);
          const { data: tx, error: txErr } = await admin
            .from('creator_product_transactions')
            .insert({
              user_id: userId,
              creator_product_id: productId,
              amount_cents: amountCents,
              currency: 'USD',
              payment_provider: 'credits',
              status: 'succeeded',
              payment_intent_id: ref,
              provider_transaction_reference: ref,
              creator_share_cents: splits.creatorShare,
              platform_share_cents: splits.platformShare,
              agency_share_cents: splits.agencyShare > 0 ? splits.agencyShare : null,
              agency_profile_id: splits.agencyProfileId || null,
              shipping_address: shippingAddress || null,
            })
            .select()
            .single();
          if (txErr || !tx) throw txErr;
          await admin.from('creator_product_orders').insert({
            creator_product_id: productId,
            user_id: userId,
            creator_product_transaction_id: tx.id,
            quantity: 1,
            order_status: 'paid',
            shipping_address: shippingAddress || null,
          });
          const { data: buyerProfile } = await admin
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
        });
      }
    }
  } catch (e) {
    console.error('executeCreditSpendPurchase', e);
    return { ok: false, status: 500, error: 'Internal server error' };
  }
}
