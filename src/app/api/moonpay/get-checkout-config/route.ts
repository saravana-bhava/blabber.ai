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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentType = searchParams.get('type');
    const transactionId = searchParams.get('transactionId');
    const paymentId = searchParams.get('paymentId');
    const userId = searchParams.get('userId'); // Pass userId to verify ownership

    if (!paymentType) {
      return NextResponse.json(
        { error: 'Payment type is required' },
        { status: 400 }
      );
    }

    const id = paymentId || transactionId;
    if (!id) {
      return NextResponse.json(
        { error: 'Transaction ID or Payment ID is required' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    let transaction: any = null;
    let additionalJSON: any = {};

    switch (paymentType) {
      case 'ppv': {
        const { data, error } = await supabase
          .from('ppv_transactions')
          .select('id, user_id, amount_cents, post_id, message_id')
          .eq('id', transactionId)
          .eq('user_id', userId)
          .eq('status', 'pending')
          .single();

        if (error || !data) {
          return NextResponse.json(
            { error: 'Transaction not found or already processed' },
            { status: 404 }
          );
        }

        transaction = data;
        additionalJSON = {
          userId: data.user_id,
          transactionId: data.id,
          postId: data.post_id || null,
          messageId: data.message_id || null,
        };
        break;
      }
      case 'tip': {
        const { data, error } = await supabase
          .from('tip_transactions')
          .select('id, user_id, amount_cents, post_id, creator_id')
          .eq('id', transactionId)
          .eq('user_id', userId)
          .eq('status', 'pending')
          .single();

        if (error || !data) {
          return NextResponse.json(
            { error: 'Transaction not found or already processed' },
            { status: 404 }
          );
        }

        transaction = data;
        additionalJSON = {
          userId: data.user_id,
          transactionId: data.id,
          postId: data.post_id || null,
          creatorId: data.creator_id,
        };
        break;
      }
      case 'product': {
        const { data, error } = await supabase
          .from('creator_product_transactions')
          .select('id, user_id, amount_cents, creator_product_id, shipping_address')
          .eq('id', transactionId)
          .eq('user_id', userId)
          .eq('status', 'pending')
          .single();

        if (error || !data) {
          return NextResponse.json(
            { error: 'Transaction not found or already processed' },
            { status: 404 }
          );
        }

        transaction = data;
        additionalJSON = {
          userId: data.user_id,
          transactionId: data.id,
          productId: data.creator_product_id,
          shippingAddress: data.shipping_address,
        };
        break;
      }
      case 'subscription': {
        const { data, error } = await supabase
          .from('subscription_payments')
          .select('id, user_id, amount_cents, creator_profile_id, subscription_id')
          .eq('id', paymentId)
          .eq('user_id', userId)
          .eq('status', 'pending')
          .single();

        if (error || !data) {
          return NextResponse.json(
            { error: 'Payment not found or already processed' },
            { status: 404 }
          );
        }

        // Get creator username for redirect
        const { data: creatorProfile, error: creatorError } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', data.creator_profile_id)
          .single();

        transaction = data;
        additionalJSON = {
          userId: data.user_id,
          creatorId: data.creator_profile_id,
          creatorUsername: creatorProfile?.username || null,
          paymentId: data.id,
          subscriptionId: data.subscription_id,
          isCrypto: true,
        };
        break;
      }
      case 'credit': {
        const { data, error } = await supabase
          .from('credit_transactions')
          .select('id, user_id, amount_cents, credits_purchased')
          .eq('id', transactionId)
          .eq('user_id', userId)
          .eq('status', 'pending')
          .single();

        if (error || !data) {
          return NextResponse.json(
            { error: 'Transaction not found or already processed' },
            { status: 404 }
          );
        }

        transaction = data;
        additionalJSON = {
          userId: data.user_id,
          credits: data.credits_purchased,
          transactionId: data.id,
        };
        break;
      }
      default:
        return NextResponse.json(
          { error: 'Invalid payment type' },
          { status: 400 }
        );
    }

    // Reconstruct moonpayConfig from database record
    const moonpayConfig = {
      paylinkId: process.env.NEXT_PUBLIC_MOONPAY_PAYLINK_ID,
      amount: (transaction.amount_cents / 100).toFixed(2), // Convert cents to dollars
      transactionId: transaction.id,
      paymentId: paymentId || undefined,
      additionalJSON,
    };

    return NextResponse.json(moonpayConfig);
  } catch (error) {
    console.error('Error retrieving checkout config:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve checkout config' },
      { status: 500 }
    );
  }
}

