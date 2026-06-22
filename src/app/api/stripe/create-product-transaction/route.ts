import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import Stripe from 'stripe';
import { calculatePaymentSplitsStore } from '@/lib/payments/calculate-splits-store';
import { createProductPurchaseNotification } from '@/app/actions/notificationActions';
import { assertAdminTestBypassAllowed } from '@/lib/payments/require-admin-test-bypass';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
});

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    
    // Get the current user's session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { productId, paymentIntentId, amountCents, isDemo, shippingAddress, adminTestBypass } =
      await request.json();

    if (!productId || !amountCents) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const adminDenied = await assertAdminTestBypassAllowed(supabase, session.user.id, adminTestBypass);
    if (adminDenied) return adminDenied;

    const effectivePaymentIntentId = adminTestBypass
      ? `admin_test_product_${Date.now()}`
      : paymentIntentId;
    if (!effectivePaymentIntentId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const skipStripe =
      !!adminTestBypass || isDemo || effectivePaymentIntentId.startsWith('demo_');
    const paymentProvider = adminTestBypass ? 'admin_test' : skipStripe ? 'demo' : 'stripe';

    let paymentIntent = null;
    let shippingAddressData = null;

    if (skipStripe) {
      // Demo / admin test: skip Stripe verification and use provided shipping address
      shippingAddressData = shippingAddress || null;
    } else {
      // Regular mode: verify the payment intent with Stripe
      paymentIntent = await stripe.paymentIntents.retrieve(effectivePaymentIntentId);
      if (paymentIntent.status !== 'succeeded') {
        return NextResponse.json({ error: 'Payment not completed' }, { status: 400 });
      }
      shippingAddressData = paymentIntent.metadata.shippingAddress ? JSON.parse(paymentIntent.metadata.shippingAddress) : null;
    }

    // Get the product details
    const { data: product, error: productError } = await supabase
      .from('creator_products')
      .select('*')
      .eq('id', productId)
      .eq('is_active', true)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Calculate payment splits (includes any agency cut)
    const { creatorShare, platformShare, agencyShare, agencyProfileId } =
      await calculatePaymentSplitsStore(amountCents, product.creator_profile_id);

    // Create the product transaction
    const { data: transaction, error: transactionError } = await supabase
      .from('creator_product_transactions')
      .insert({
        user_id: session.user.id,
        creator_product_id: productId,
        amount_cents: amountCents,
        currency: 'USD',
        payment_provider: paymentProvider,
        payment_intent_id: effectivePaymentIntentId,
        status: 'succeeded',
        provider_transaction_reference: effectivePaymentIntentId,
        creator_share_cents: creatorShare,
        platform_share_cents: platformShare,
        agency_share_cents: agencyShare > 0 ? agencyShare : null,
        agency_profile_id: agencyProfileId || null,
        shipping_address: shippingAddressData,
      })
      .select()
      .single();

    if (transactionError) {
      console.error('Error creating transaction:', transactionError);
      return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
    }

    // Create the product order
    const { data: order, error: orderError } = await supabase
      .from('creator_product_orders')
      .insert({
        creator_product_id: productId,
        user_id: session.user.id,
        creator_product_transaction_id: transaction.id,
        quantity: 1,
        order_status: 'paid',
        shipping_address: shippingAddressData,
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
    }

    // Get buyer's username for notification
    const { data: buyerProfile, error: buyerError } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', session.user.id)
      .single();

    // Create notification for the creator about the product purchase
    try {
      await createProductPurchaseNotification({
        creatorId: product.creator_profile_id,
        buyerId: session.user.id,
        buyerUsername: buyerProfile?.username || 'Someone',
        productName: product.product_name,
        amount: amountCents / 100
      });
    } catch (notificationError) {
      console.error('Error creating product purchase notification:', notificationError);
      // Don't fail the transaction if notification fails
    }

    return NextResponse.json({
      transactionId: transaction.id,
      orderId: order.id,
    });
  } catch (error) {
    console.error('Error creating product transaction:', error);
    return NextResponse.json(
      { error: 'Failed to create transaction' },
      { status: 500 }
    );
  }
} 