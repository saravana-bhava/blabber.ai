import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { calculatePaymentSplitsStore } from '@/lib/payments/calculate-splits-store';
import type { UsPaymatePaymentMetadata } from '@/lib/payments/uspaymate';
import {
  getUsPaymateCustomerFromSession,
  startUsPaymateCheckout,
} from '@/lib/payments/uspaymate-checkout-helper';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { productId, amountCents, shippingAddress, returnUrl } = await request.json();

    if (!productId || !amountCents) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: product, error: productError } = await supabase
      .from('creator_products')
      .select('*')
      .eq('id', productId)
      .eq('is_active', true)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const expectedAmount = product.price_cents + (product.shipping_price_cents || 0);
    if (amountCents !== expectedAmount) {
      return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
    }

    const shippingMinor = product.shipping_price_cents || 0;
    const productMinor = product.price_cents;

    const { creatorShare, platformShare, agencyShare, agencyProfileId } =
      await calculatePaymentSplitsStore(amountCents, product.creator_profile_id);

    const customer = await getUsPaymateCustomerFromSession(
      supabase,
      session.user.id,
      session.user.email
    );

    const metadata: UsPaymatePaymentMetadata = {
      userId: session.user.id,
      transactionType: 'product',
      productId,
      creatorId: product.creator_profile_id,
      amountCents,
      creatorShareCents: creatorShare,
      platformShareCents: platformShare,
      agencyShareCents: agencyShare,
      agencyProfileId,
      shippingAddress: shippingAddress ? JSON.stringify(shippingAddress) : undefined,
    };

    const lineItems = [
      {
        name: product.product_name,
        quantity: 1,
        price_minor: productMinor,
        line_total_minor: productMinor,
      },
    ];

    const { paymentUrl } = await startUsPaymateCheckout(supabaseAdmin, {
      userId: session.user.id,
      userEmail: customer.email,
      userName: customer.name,
      callbackType: 'product',
      returnUrl,
      amountCents,
      lineItems,
      shippingTotalMinor: shippingMinor,
      metadata,
    });

    return NextResponse.json({ paymentUrl });
  } catch (error) {
    console.error('Error creating USPaymate product checkout:', error);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
