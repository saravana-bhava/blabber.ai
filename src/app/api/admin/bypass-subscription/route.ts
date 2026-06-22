import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { assertAdminTestBypassAllowed } from '@/lib/payments/require-admin-test-bypass';
import { createNewSubscriptionNotification } from '@/app/actions/notificationActions';
import { fetchAgencyAttributionForCreator } from '@/lib/payments/agency-split';

function getIntervalInMs(interval: 'month' | 'year'): number {
  const now = new Date();
  const next = new Date(now);
  if (interval === 'month') {
    next.setMonth(next.getMonth() + 1);
  } else {
    next.setFullYear(next.getFullYear() + 1);
  }
  return next.getTime() - now.getTime();
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const denied = await assertAdminTestBypassAllowed(supabase, user.id, true);
    if (denied) return denied;

    const body = await request.json();
    const creatorId = body.creatorId as string | undefined;
    const subscription_price_cents = body.subscription_price_cents as number | undefined;
    const subscription_interval = body.subscription_interval as 'month' | 'year' | undefined;

    if (!creatorId || !subscription_price_cents || !subscription_interval) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (subscription_interval !== 'month' && subscription_interval !== 'year') {
      return NextResponse.json({ error: 'Invalid subscription interval' }, { status: 400 });
    }

    const periodEnd = new Date(Date.now() + getIntervalInMs(subscription_interval)).toISOString();
    const providerId = `admin_test_sub_${Date.now()}`;

    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('follower_id', user.id)
      .eq('following_id', creatorId)
      .maybeSingle();

    let subscription;
    if (existingSubscription) {
      const { data: updated, error: updateError } = await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          current_period_ends_at: periodEnd,
          provider_subscription_id: providerId,
          price_at_time_of_subscription_cents: subscription_price_cents,
          interval_at_time_of_subscription: subscription_interval,
          payment_provider: 'admin_test',
          canceled_at: null,
        })
        .eq('id', existingSubscription.id)
        .select()
        .single();
      if (updateError || !updated) {
        console.error('bypass-subscription update:', updateError);
        return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
      }
      subscription = updated;
    } else {
      const { data: created, error: insertError } = await supabase
        .from('subscriptions')
        .insert({
          follower_id: user.id,
          following_id: creatorId,
          status: 'active',
          current_period_ends_at: periodEnd,
          provider_subscription_id: providerId,
          price_at_time_of_subscription_cents: subscription_price_cents,
          interval_at_time_of_subscription: subscription_interval,
          payment_provider: 'admin_test',
        })
        .select()
        .single();
      if (insertError || !created) {
        console.error('bypass-subscription insert:', insertError);
        return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
      }
      subscription = created;
    }

    const creatorShareCents = Math.round(subscription_price_cents * 0.7);
    const { agencyShare, agencyProfileId } = await fetchAgencyAttributionForCreator(
      creatorId,
      creatorShareCents
    );

    const { error: paymentRecordError } = await supabase.from('subscription_payments').insert({
      subscription_id: subscription.id,
      user_id: user.id,
      creator_profile_id: creatorId,
      amount_cents: subscription_price_cents,
      currency: 'usd',
      payment_provider: 'admin_test',
      payment_intent_id: `admin_test_sub_pay_${Date.now()}`,
      status: 'succeeded',
      period_starts_at: new Date().toISOString(),
      period_ends_at: periodEnd,
      creator_share_cents: creatorShareCents,
      platform_share_cents: Math.round(subscription_price_cents * 0.3),
      agency_share_cents: agencyShare > 0 ? agencyShare : null,
      agency_profile_id: agencyProfileId || null,
    });

    if (paymentRecordError) {
      console.error('bypass-subscription payment:', paymentRecordError);
      return NextResponse.json({ error: 'Failed to create payment record' }, { status: 500 });
    }

    try {
      const { data: subscriberProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();

      if (subscriberProfile?.username) {
        await createNewSubscriptionNotification({
          creatorId,
          subscriberId: user.id,
          subscriberUsername: subscriberProfile.username,
        });
      }
    } catch (e) {
      console.error('bypass-subscription notification:', e);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('bypass-subscription:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
