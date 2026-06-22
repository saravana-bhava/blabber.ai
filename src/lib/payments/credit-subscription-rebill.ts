import { createClient } from '@supabase/supabase-js';
import {
  getCreditOnlyMonetizationSettings,
  usdCentsToCreditsRequired,
} from '@/lib/payments/credit-only-settings';
import { calculatePaymentSplitsContentServer } from '@/lib/payments/calculate-splits-server';

function createAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function uniqueRef(subId: string) {
  return `credit_rebill_${subId}_${crypto.randomUUID()}`;
}

export type CreditSubscriptionRebillResult = {
  ok: true;
  skipped?: boolean;
  renewed: number;
  canceledInsufficient: number;
  totalDue: number;
  errors?: string[];
};

/**
 * When credit_only_ecosystem is on: find active credit-funded subscriptions past
 * current_period_ends_at, debit credits for the next period (same USD cents → credits
 * as initial subscribe), extend the period, and record subscription_payments.
 * If the fan has insufficient credits, cancel the subscription.
 */
export async function runCreditSubscriptionRebillJob(): Promise<CreditSubscriptionRebillResult> {
  const settings = await getCreditOnlyMonetizationSettings();
  if (!settings.creditOnlyEcosystem) {
    return { ok: true, skipped: true, renewed: 0, canceledInsufficient: 0, totalDue: 0 };
  }

  const admin = createAdmin();
  const now = new Date().toISOString();

  const { data: due, error: fetchErr } = await admin
    .from('subscriptions')
    .select(
      'id, follower_id, following_id, current_period_ends_at, price_at_time_of_subscription_cents, interval_at_time_of_subscription'
    )
    .eq('payment_provider', 'credits')
    .eq('status', 'active')
    .lte('current_period_ends_at', now);

  if (fetchErr) {
    console.error('credit subscription rebill fetch', fetchErr);
    return {
      ok: true,
      renewed: 0,
      canceledInsufficient: 0,
      totalDue: 0,
      errors: [fetchErr.message],
    };
  }

  const list = due || [];
  if (!list.length) {
    return { ok: true, renewed: 0, canceledInsufficient: 0, totalDue: 0 };
  }

  let renewed = 0;
  let canceledInsufficient = 0;
  const errors: string[] = [];
  const pricePerCredit = settings.pricePerCreditCents;

  for (const sub of list) {
    const userId = sub.follower_id;
    const creatorId = sub.following_id;
    const amountCents = sub.price_at_time_of_subscription_cents || 0;
    const interval = sub.interval_at_time_of_subscription || 'month';

    if (!sub.current_period_ends_at) {
      errors.push(`Subscription ${sub.id}: missing current_period_ends_at`);
      continue;
    }

    if (amountCents <= 0) {
      errors.push(`Subscription ${sub.id}: invalid amount (${amountCents}), skipping`);
      continue;
    }

    const credits = usdCentsToCreditsRequired(amountCents, pricePerCredit);

    const { data: debitData, error: debitErr } = await admin.rpc('debit_credits_if_sufficient', {
      p_user_id: userId,
      p_credits: credits,
    });

    if (debitErr) {
      errors.push(`Subscription ${sub.id}: debit RPC error ${debitErr.message}`);
      continue;
    }

    const row = debitData as { ok?: boolean; error?: string } | null;
    if (!row?.ok) {
      if (row?.error === 'insufficient_credits') {
        const { error: cancelErr } = await admin
          .from('subscriptions')
          .update({
            status: 'canceled',
            canceled_at: new Date().toISOString(),
          })
          .eq('id', sub.id);
        if (cancelErr) {
          errors.push(`Subscription ${sub.id}: failed to cancel after insufficient credits — ${cancelErr.message}`);
        } else {
          canceledInsufficient++;
        }
      } else {
        errors.push(`Subscription ${sub.id}: debit failed — ${row?.error || 'unknown'}`);
      }
      continue;
    }

    const ref = uniqueRef(sub.id);

    try {
      const splits = await calculatePaymentSplitsContentServer(amountCents, creatorId);
      const periodStart = new Date(sub.current_period_ends_at);
      const periodEnd = new Date(periodStart);
      if (interval === 'month') periodEnd.setMonth(periodEnd.getMonth() + 1);
      else periodEnd.setFullYear(periodEnd.getFullYear() + 1);

      const { error: payInsertErr } = await admin.from('subscription_payments').insert({
        subscription_id: sub.id,
        user_id: userId,
        creator_profile_id: creatorId,
        amount_cents: amountCents,
        currency: 'USD',
        payment_provider: 'credits',
        status: 'succeeded',
        payment_intent_id: ref,
        provider_transaction_reference: ref,
        period_starts_at: periodStart.toISOString(),
        period_ends_at: periodEnd.toISOString(),
        creator_share_cents: splits.creatorShare,
        platform_share_cents: splits.platformShare,
        agency_share_cents: splits.agencyShare > 0 ? splits.agencyShare : null,
        agency_profile_id: splits.agencyProfileId || null,
      });

      if (payInsertErr) {
        await admin.rpc('refund_credits', { p_user_id: userId, p_credits: credits });
        errors.push(`Subscription ${sub.id}: payment record failed — ${payInsertErr.message}`);
        continue;
      }

      const { error: subUpdErr } = await admin
        .from('subscriptions')
        .update({
          current_period_ends_at: periodEnd.toISOString(),
          provider_subscription_id: ref,
          status: 'active',
          canceled_at: null,
        })
        .eq('id', sub.id);

      if (subUpdErr) {
        await admin.rpc('refund_credits', { p_user_id: userId, p_credits: credits });
        errors.push(`Subscription ${sub.id}: subscription update failed — ${subUpdErr.message}`);
        continue;
      }

      renewed++;
    } catch (e) {
      await admin.rpc('refund_credits', { p_user_id: userId, p_credits: credits });
      errors.push(`Subscription ${sub.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return {
    ok: true,
    renewed,
    canceledInsufficient,
    totalDue: list.length,
    errors: errors.length ? errors : undefined,
  };
}
