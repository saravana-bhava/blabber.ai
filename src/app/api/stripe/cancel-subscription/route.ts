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

    const { subscriptionId } = await request.json();

    if (!subscriptionId || typeof subscriptionId !== 'string') {
      return new NextResponse('Subscription ID is required', { status: 400 });
    }

    // Only real Stripe subscriptions use ids like sub_xxx. Demo / admin test / other providers
    // store synthetic ids; the client already marks the row canceled in Supabase.
    const isStripeSubscription = /^sub_[a-zA-Z0-9]+$/.test(subscriptionId);
    if (isStripeSubscription) {
      await stripe.subscriptions.cancel(subscriptionId);
    }

    return new NextResponse('Subscription canceled successfully');
  } catch (error) {
    console.error('Error canceling subscription:', error);
    if (error instanceof Stripe.errors.StripeError) {
      return new NextResponse(`Stripe error: ${error.message}`, { status: 400 });
    }
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 