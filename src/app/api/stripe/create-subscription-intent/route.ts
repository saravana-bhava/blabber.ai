import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { cookies } from 'next/headers';
import { calculatePaymentSplits } from '@/lib/payments/calculate-splits';

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

    // Get user's profile to check for Stripe customer ID
    const { data: userProfile, error: userProfileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', session.user.id)
      .single();

    if (userProfileError) {
      console.error('Error fetching user profile:', userProfileError);
      return new NextResponse(`User profile not found: ${userProfileError.message}`, { status: 404 });
    }

    // Create Stripe customer if one doesn't exist
    let customerId = userProfile.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email,
        metadata: {
          userId: session.user.id,
        },
      });
      customerId = customer.id;

      // Update user's profile with Stripe customer ID
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', session.user.id);

      if (updateError) {
        console.error('Error updating profile with Stripe customer ID:', updateError);
        return new NextResponse('Error updating user profile', { status: 500 });
      }

    }

    // Get creator's Stripe account ID and subscription details
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('subscription_price_cents, subscription_interval')
      .eq('profile_id', creatorId)
      .single();

    if (creatorError || !creator) {
      console.error('Error fetching creator:', creatorError);
      return new NextResponse('Creator not found', { status: 404 });
    }

    if (!creator.subscription_price_cents || !creator.subscription_interval) {
      console.error('Creator has no subscription price or interval:', creator);
      return new NextResponse('Creator has not set up subscription pricing', { status: 400 });
    }

    // Calculate payment splits (includes any agency cut)
    const { creatorShare, platformShare, agencyShare, agencyProfileId } =
      await calculatePaymentSplits(creator.subscription_price_cents, creatorId);

    // Create a product for the subscription
    const product = await stripe.products.create({
      name: 'Creator Subscription',
      metadata: {
        creatorId,
      },
    });

    // Create a price for the product
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: creator.subscription_price_cents,
      currency: 'usd',
      recurring: {
        interval: creator.subscription_interval,
      },
    });

    // Create a subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: price.id }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        creatorId,
        subscriberId: session.user.id,
        creatorShare: String(creatorShare),
        platformShare: String(platformShare),
        agencyShare: String(agencyShare),
        agencyProfileId: agencyProfileId || '',
      },
    });

    // Get the latest invoice and payment intent
    const invoice = subscription.latest_invoice as Stripe.Invoice & { payment_intent?: Stripe.PaymentIntent };
    if (!invoice || typeof invoice === 'string') {
      throw new Error('No invoice found in subscription');
    }

    // Create a payment intent if one doesn't exist
    let paymentIntent;
    if (!invoice.payment_intent) {
      paymentIntent = await stripe.paymentIntents.create({
        amount: invoice.amount_due,
        currency: invoice.currency,
        customer: customerId,
        payment_method_types: ['card'],
        metadata: {
          subscriptionId: subscription.id,
          creatorId,
          subscriberId: session.user.id,
          creatorShare: creatorShare.toString(),
          platformShare: platformShare.toString(),
          agencyShare: agencyShare.toString(),
          agencyProfileId: agencyProfileId || '',
        },
      });
    } else {
      // Update existing payment intent with metadata
      paymentIntent = await stripe.paymentIntents.update(invoice.payment_intent.id, {
        metadata: {
          subscriptionId: subscription.id,
          creatorId,
          subscriberId: session.user.id,
          creatorShare: creatorShare.toString(),
          platformShare: platformShare.toString(),
          agencyShare: agencyShare.toString(),
          agencyProfileId: agencyProfileId || '',
        },
      });
    }

    if (!paymentIntent || typeof paymentIntent === 'string') {
      throw new Error('No payment intent found or created');
    }

    if (!paymentIntent.client_secret) {
      throw new Error('No client secret in payment intent');
    }

    return NextResponse.json({ 
      clientSecret: paymentIntent.client_secret,
      subscriptionId: subscription.id 
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    if (error instanceof Stripe.errors.StripeError) {
      return new NextResponse(`Stripe error: ${error.message}`, { status: 400 });
    }
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 