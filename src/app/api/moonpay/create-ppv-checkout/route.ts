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
    const { amount, userId, postId, messageId } = await request.json();

    if (!amount || !userId || (!postId && !messageId)) {
      return NextResponse.json(
        { error: 'Amount, userId, and postId or messageId are required' },
        { status: 400 }
      );
    }

    // Check for existing transaction first (to handle unique constraint)
    // For posts: check by user_id and post_id
    // For messages: check by user_id and message_id
    let existingTransaction = null;
    if (postId) {
      const { data, error } = await supabase
        .from('ppv_transactions')
        .select('id, status, created_at')
        .eq('user_id', userId)
        .eq('post_id', postId)
        .maybeSingle();
      existingTransaction = data;
    } else if (messageId) {
      const { data, error } = await supabase
        .from('ppv_transactions')
        .select('id, status, created_at')
        .eq('user_id', userId)
        .eq('message_id', messageId)
        .maybeSingle();
      existingTransaction = data;
    }

    // If transaction exists, handle based on status
    if (existingTransaction) {
      if (existingTransaction.status === 'succeeded') {
        return NextResponse.json(
          { error: 'You have already purchased this content' },
          { status: 400 }
        );
      }

      if (existingTransaction.status === 'pending') {
        return NextResponse.json(
          { error: 'Transaction still pending' },
          { status: 400 }
        );
      }
    }

    // Create a pending transaction record
    const { data: transaction, error: transactionError } = await supabase
      .from('ppv_transactions')
      .insert({
        user_id: userId,
        amount_cents: amount,
        post_id: postId || null,
        currency: 'USD',
        payment_provider: 'moonpay',
        status: 'pending',
      })
      .select()
      .single();

    if (transactionError || !transaction) {
      // Check if it's a unique constraint violation (shouldn't happen now, but as fallback)
      if (transactionError?.code === '23505') {
        // Try to get the existing transaction (fallback for race conditions)
        let conflictTransaction = null;
        if (postId) {
          const { data } = await supabase
            .from('ppv_transactions')
            .select('id, status')
            .eq('user_id', userId)
            .eq('post_id', postId)
            .maybeSingle();
          conflictTransaction = data;
        } else if (messageId) {
          const { data } = await supabase
            .from('ppv_transactions')
            .select('id, status')
            .eq('user_id', userId)
            .eq('message_id', messageId)
            .maybeSingle();
          conflictTransaction = data;
        }

        if (conflictTransaction?.status === 'pending') {
          return NextResponse.json(
            { error: 'Transaction still pending' },
            { status: 400 }
          );
        }

        return NextResponse.json(
          { error: 'A transaction for this content already exists' },
          { status: 400 }
        );
      }

      console.error('Error creating PPV transaction:', transactionError);
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
        messageId: messageId || null,
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

