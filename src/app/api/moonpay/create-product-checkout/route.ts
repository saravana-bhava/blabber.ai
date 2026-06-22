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
    const { amount, userId, productId, shippingAddress } = await request.json();

    if (!amount || !userId || !productId) {
      return NextResponse.json(
        { error: 'Amount, userId, and productId are required' },
        { status: 400 }
      );
    }

    // Create a pending transaction record
    const { data: transaction, error: transactionError } = await supabase
      .from('creator_product_transactions')
      .insert({
        user_id: userId,
        creator_product_id: productId,
        amount_cents: amount,
        currency: 'USD',
        payment_provider: 'moonpay',
        status: 'pending',
        shipping_address: shippingAddress || null,
      })
      .select()
      .single();

    if (transactionError || !transaction) {
      console.error('Error creating product transaction:', transactionError);
      return NextResponse.json(
        { error: 'Failed to create transaction record' },
        { status: 500 }
      );
    }

    // Create order record with shipping address
    const { data: order, error: orderError } = await supabase
      .from('creator_product_orders')
      .insert({
        creator_product_id: productId,
        user_id: userId,
        creator_product_transaction_id: transaction.id,
        quantity: 1,
        order_status: 'pending',
        shipping_address: shippingAddress || null,
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      // Don't fail the request if order creation fails, transaction is already created
    }

    // Return the configuration for the MoonPay checkout widget
    return NextResponse.json({
      paylinkId: process.env.NEXT_PUBLIC_MOONPAY_PAYLINK_ID,
      amount: (amount / 100).toFixed(2), // Convert cents to dollars
      transactionId: transaction.id,
      additionalJSON: {
        userId,
        transactionId: transaction.id,
        productId,
        orderId: order?.id || null,
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

