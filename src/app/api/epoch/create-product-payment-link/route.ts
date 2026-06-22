import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { createEpochPaymentLink, EpochPaymentMetadata } from '@/lib/payments/epoch';
import { calculatePaymentSplitsStore } from '@/lib/payments/calculate-splits-store';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    
    // Get the current user's session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { productId, amountCents, shippingAddress, returnUrl } = await request.json();

    if (!productId || !amountCents) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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

    // Verify the amount matches the product price + shipping
    const expectedAmount = product.price_cents + (product.shipping_price_cents || 0);
    if (amountCents !== expectedAmount) {
      return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
    }

    // Calculate payment splits (includes any agency cut)
    const { creatorShare, platformShare, agencyShare, agencyProfileId } =
      await calculatePaymentSplitsStore(amountCents, product.creator_profile_id);

    // Create metadata for the payment
    const metadata: EpochPaymentMetadata = {
      userId: session.user.id,
      transactionType: 'product',
      productId,
      creatorId: product.creator_profile_id,
      amountCents,
      creatorShareCents: creatorShare,
      platformShareCents: platformShare,
      agencyShareCents: agencyShare,
      agencyProfileId: agencyProfileId,
      shippingAddress: shippingAddress ? JSON.stringify(shippingAddress) : undefined,
    };

    // Create Epoch payment link
    const paymentUrl = await createEpochPaymentLink({
      amount: amountCents / 100, // Convert cents to dollars
      currency: 'USD',
      metadata,
      noUserPass: true,
      redirectUrl: `${process.env.EPOCH_REDIRECT_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://blabber.ai'}/epoch-callback?type=product${returnUrl ? `&returnUrl=${encodeURIComponent(returnUrl)}` : ''}`,
    });

    return NextResponse.json({ paymentUrl });
  } catch (error) {
    console.error('Error creating Epoch product payment link:', error);
    return NextResponse.json(
      { error: 'Failed to create payment link' },
      { status: 500 }
    );
  }
}
