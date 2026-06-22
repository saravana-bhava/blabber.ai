import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { cookies } from 'next/headers';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
});

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { creatorId } = await request.json();

    if (!creatorId || typeof creatorId !== 'string') {
      return new NextResponse('creatorId is required', { status: 400 });
    }

    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('subscription_price_cents, subscription_interval, subscription_tier_enabled')
      .eq('profile_id', creatorId)
      .single();

    if (creatorError || !creator) {
      return new NextResponse('Creator not found', { status: 404 });
    }

    if (
      !creator.subscription_tier_enabled ||
      !creator.subscription_price_cents ||
      !creator.subscription_interval
    ) {
      return new NextResponse('Creator has not set up subscription pricing', { status: 400 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', creatorId)
      .single();

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
    const cancelPath = profile?.username ? `/u/${profile.username}` : '/home';

    const interval =
      creator.subscription_interval === 'year' ? 'year' : 'month';

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: creator.subscription_price_cents,
            recurring: { interval },
            product_data: {
              name: 'Creator subscription',
              metadata: { creatorProfileId: creatorId },
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}${cancelPath}`,
      customer_email: session.user.email ?? undefined,
      metadata: {
        creatorId,
        subscriberId: session.user.id,
      },
    });

    return NextResponse.json({ sessionId: checkoutSession.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
