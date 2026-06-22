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
    const { amount, userId, postId, creatorId } = await request.json();

    if (!amount || !userId || !creatorId) {
      return NextResponse.json(
        { error: 'Amount, userId, and creatorId are required' },
        { status: 400 }
      );
    }
    if (amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Create a pending transaction record
    const { data: transaction, error: transactionError } = await supabase
      .from('tip_transactions')
      .insert({
        user_id: userId,
        amount_cents: amount,
        post_id: postId || null,
        creator_id: creatorId,
        currency: 'USD',
        payment_provider: 'moonpay',
        status: 'pending',
      })
      .select()
      .single();

    if (transactionError || !transaction) {
      console.error('Error creating tip transaction:', transactionError);
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
        transactionId: transaction.id,
        postId: postId || null,
        creatorId,
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

