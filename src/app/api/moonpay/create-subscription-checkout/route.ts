import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchAgencyAttributionForCreator } from '@/lib/payments/agency-split';

// Initialize Supabase admin client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
    },
  }
);

export async function POST(request: Request) {
  try {
    const { amount, userId, creatorId } = await request.json();

    if (!amount || !userId || !creatorId) {
      return NextResponse.json(
        { error: 'Amount, userId, and creatorId are required' },
        { status: 400 }
      );
    }

    // Get creator details for share calculation
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('subscription_price_cents, subscription_interval')
      .eq('profile_id', creatorId)
      .single();

    if (creatorError || !creator) {
      return NextResponse.json(
        { error: 'Creator not found' },
        { status: 404 }
      );
    }

    // Calculate creator and platform shares (assuming 70/30 split)
    const creatorShareCents = Math.round(amount * 0.7);
    const platformShareCents = amount - creatorShareCents;

    const { agencyShare: subAgencyShare, agencyProfileId: subAgencyId } =
      await fetchAgencyAttributionForCreator(creatorId, creatorShareCents);

    // Check for existing subscription
    const { data: existingSubscription, error: existingSubError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('follower_id', userId)
      .eq('following_id', creatorId)
      .maybeSingle();

    // subscription_id is NOT NULL, so we need to create/use a subscription record
    let subscriptionId: string;
    
    if (existingSubscription) {
      subscriptionId = existingSubscription.id;
    } else {
      // Create a pending subscription record for this crypto payment
      // For crypto subscriptions, expiration is 30 days
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      const { data: newSubscription, error: subCreateError } = await supabase
        .from('subscriptions')
        .insert({
          follower_id: userId,
          following_id: creatorId,
          status: 'incomplete', // Will be activated when payment succeeds
          current_period_ends_at: thirtyDaysFromNow.toISOString(),
          provider_subscription_id: `moonpay_pending_${Date.now()}`,
          price_at_time_of_subscription_cents: amount,
          interval_at_time_of_subscription: 'month', // Default, but expiration is 30 days
          payment_provider: 'moonpay',
        })
        .select('id')
        .single();

      if (subCreateError || !newSubscription) {
        console.error('Error creating subscription:', subCreateError);
        return NextResponse.json(
          { error: 'Failed to create subscription record' },
          { status: 500 }
        );
      }
      
      subscriptionId = newSubscription.id;
    }

    // Create a pending subscription payment record
    // Note: For crypto subscriptions, we'll set expiration to 30 days later
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const { data: payment, error: paymentError } = await supabase
      .from('subscription_payments')
      .insert({
        subscription_id: subscriptionId,
        user_id: userId,
        creator_profile_id: creatorId,
        amount_cents: amount,
        currency: 'USD',
        payment_provider: 'moonpay',
        status: 'pending',
        period_starts_at: now.toISOString(),
        period_ends_at: thirtyDaysFromNow.toISOString(), // 30 days for crypto subscriptions
        creator_share_cents: creatorShareCents,
        platform_share_cents: platformShareCents,
        agency_share_cents: subAgencyShare > 0 ? subAgencyShare : null,
        agency_profile_id: subAgencyId || null,
      })
      .select()
      .single();

    if (paymentError || !payment) {
      console.error('Error creating subscription payment:', paymentError);
      return NextResponse.json(
        { error: 'Failed to create payment record' },
        { status: 500 }
      );
    }

    // Return the configuration for the MoonPay checkout widget
    return NextResponse.json({
      paylinkId: process.env.NEXT_PUBLIC_MOONPAY_PAYLINK_ID,
      amount: (amount / 100).toFixed(2), // Convert cents to dollars
      paymentId: payment.id,
      additionalJSON: {
        userId,
        creatorId,
        paymentId: payment.id,
        subscriptionId: subscriptionId,
        isCrypto: true, // Flag to indicate this is a crypto subscription
      },
    });
  } catch (error) {
    console.error('Error creating MoonPay checkout:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

