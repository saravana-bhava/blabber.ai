import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
});

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const authClient = createClient(cookieStore);
    const {
      data: { session },
    } = await authClient.auth.getSession();

    const { amount, userId, credits } = await request.json();

    if (!amount || !userId || credits == null) {
      return NextResponse.json(
        { error: 'Amount, userId, and credits are required' },
        { status: 400 }
      );
    }

    if (!session?.user || session.user.id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const creditsNum = parseInt(String(credits), 10);
    if (!Number.isFinite(creditsNum) || creditsNum < 1) {
      return NextResponse.json({ error: 'Invalid credits' }, { status: 400 });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      payment_method_types: ['card'],
      metadata: {
        userId,
        type: 'credit_purchase',
        credits: String(creditsNum),
        amountCents: String(amount),
      },
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Error creating credit payment intent:', error);
    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    );
  }
}
