import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    const { amount, userId, credits } = await request.json();

    if (!amount || !userId || !credits) {
      return NextResponse.json(
        { error: 'Amount, userId, and credits are required' },
        { status: 400 }
      );
    }

    // Create a pending transaction record
    const { data: transaction, error: transactionError } = await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount_cents: amount,
        credits_purchased: credits,
        currency: 'USD',
        payment_provider: 'moonpay',
        status: 'pending',
      })
      .select()
      .single();

    if (transactionError || !transaction) {
      console.error('Error creating credit transaction:', transactionError);
      return NextResponse.json(
        { error: 'Failed to create transaction record' },
        { status: 500 }
      );
    }

    // Return the configuration for the MoonPay checkout widget
    return NextResponse.json({
      paylinkId: process.env.NEXT_PUBLIC_MOONPAY_PAYLINK_ID,
      amount: (amount / 100).toFixed(2), // Convert cents to dollars
      transactionId: transaction.id,
      additionalJSON: {
        userId,
        credits,
        transactionId: transaction.id,
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

