import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processOnyxPayment } from '@/lib/payments/onyx';
import { decryptCardNumber } from '@/lib/payments/card-encryption';
import { calculatePaymentSplits } from '@/lib/payments/calculate-splits';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

/** Call this from a cron (e.g. Vercel Cron or external) with header Authorization: Bearer <CRON_SECRET> */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET || process.env.ONYX_REBILL_CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date().toISOString();
  const { data: dueSubscriptions, error: subError } = await supabaseAdmin
    .from('subscriptions')
    .select('id, follower_id, following_id, current_period_ends_at, price_at_time_of_subscription_cents, interval_at_time_of_subscription')
    .eq('payment_provider', 'onyx')
    .eq('status', 'active')
    .lte('current_period_ends_at', now);

  if (subError) {
    console.error('Onyx rebill: failed to fetch subscriptions', subError);
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
  }

  if (!dueSubscriptions?.length) {
    return NextResponse.json({ ok: true, rebilled: 0, message: 'No subscriptions due for renewal' });
  }

  let rebilled = 0;
  const errors: string[] = [];

  for (const sub of dueSubscriptions) {
    const userId = sub.follower_id;
    const creatorId = sub.following_id;
    const amountCents = sub.price_at_time_of_subscription_cents || 0;
    const interval = sub.interval_at_time_of_subscription || 'month';

    const { data: pm, error: pmError } = await supabaseAdmin
      .from('user_payment_methods')
      .select('onyx_payment_method_id, encrypted_card_number, exp_month, exp_year, billing_phone_number, billing_address, billing_city, billing_state, billing_zip, billing_first_name, billing_last_name, billing_email')
      .eq('user_id', userId)
      .eq('is_default', true)
      .maybeSingle();

    if (pmError || !pm?.onyx_payment_method_id) {
      errors.push(`Subscription ${sub.id}: no default payment method for user ${userId}`);
      continue;
    }
    if (!pm.billing_phone_number || !pm.billing_address || !pm.billing_city || !pm.billing_state || !pm.billing_zip) {
      errors.push(`Subscription ${sub.id}: saved card missing billing address for user ${userId}`);
      continue;
    }

    const billing = {
      first_name: pm.billing_first_name ?? 'Customer',
      last_name: pm.billing_last_name ?? 'User',
      email: pm.billing_email ?? '',
      phone_number: pm.billing_phone_number,
      address: pm.billing_address,
      city: pm.billing_city,
      state: pm.billing_state,
      zip: pm.billing_zip,
    };

    // Same flow as "Pay with saved card" in UI: decrypt stored card, send card + billing to Onyx (no token; cvc empty for recurring).
    let card: { number: string; exp_month: string; exp_year: string; cvc: string };
    if (pm.onyx_payment_method_id.startsWith('local-') && pm.encrypted_card_number && pm.exp_month != null && pm.exp_year != null) {
      try {
        const number = decryptCardNumber(pm.encrypted_card_number);
        const expMonth = String(pm.exp_month).padStart(2, '0');
        const expYearRaw = String(pm.exp_year);
        const expYear = expYearRaw.length === 2 ? expYearRaw : expYearRaw.slice(-2);
        card = { number, exp_month: expMonth, exp_year: expYear, cvc: '' };
      } catch (err) {
        errors.push(`Subscription ${sub.id}: could not decrypt saved card for user ${userId}`);
        continue;
      }
    } else {
      errors.push(`Subscription ${sub.id}: saved card has no stored number for user ${userId}`);
      continue;
    }

    try {
      const result = await processOnyxPayment({
        amountCents,
        currency: 'USD',
        metadata: {
          userId,
          transactionType: 'subscription' as const,
          creatorId,
          subscriptionId: sub.id,
          amountCents,
        },
        billing,
        card,
        customer_ip: '',
      });

      if (result.status !== 'SUCCESS' || !result.transaction_id) {
        errors.push(`Subscription ${sub.id}: payment failed - ${result.message || 'unknown'}`);
        continue;
      }

      const { creatorShare, platformShare, agencyShare, agencyProfileId } =
        await calculatePaymentSplits(amountCents, creatorId);
      const periodStart = new Date(sub.current_period_ends_at);
      const periodEnd = new Date(periodStart);
      if (interval === 'month') periodEnd.setMonth(periodEnd.getMonth() + 1);
      else periodEnd.setFullYear(periodEnd.getFullYear() + 1);

      const { error: payInsertErr } = await supabaseAdmin.from('subscription_payments').insert({
        subscription_id: sub.id,
        user_id: userId,
        creator_profile_id: creatorId,
        amount_cents: amountCents,
        currency: 'USD',
        payment_provider: 'onyx',
        status: 'succeeded',
        provider_transaction_reference: result.transaction_id,
        provider_specific_details: { transactionId: result.transaction_id, status: 'SUCCESS' },
        period_starts_at: periodStart.toISOString(),
        period_ends_at: periodEnd.toISOString(),
        creator_share_cents: creatorShare,
        platform_share_cents: platformShare,
        agency_share_cents: agencyShare > 0 ? agencyShare : null,
        agency_profile_id: agencyProfileId || null,
      });
      if (payInsertErr) {
        errors.push(`Subscription ${sub.id}: failed to record payment - ${payInsertErr.message}`);
        continue;
      }

      await supabaseAdmin.from('subscriptions').update({
        current_period_ends_at: periodEnd.toISOString(),
      }).eq('id', sub.id);

      rebilled++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Subscription ${sub.id}: ${msg}`);
    }
  }

  return NextResponse.json({
    ok: true,
    rebilled,
    total_due: dueSubscriptions.length,
    errors: errors.length ? errors : undefined,
  });
}
