import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { createEpochPaymentLink, EpochPaymentMetadata } from '@/lib/payments/epoch';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { amount, userId, credits, returnUrl } = await request.json();

    if (!amount || !userId || !credits) {
      return NextResponse.json(
        { error: 'Amount, userId, and credits are required' },
        { status: 400 }
      );
    }

    const amountCents = Math.round(amount);

    // Create metadata for the payment
    const metadata: EpochPaymentMetadata = {
      userId,
      transactionType: 'credit',
      amountCents,
      credits: credits.toString(),
    };

    // Create Epoch payment link
    const paymentUrl = await createEpochPaymentLink({
      amount: amountCents / 100, // Convert cents to dollars
      currency: 'USD',
      metadata,
      noUserPass: true,
      redirectUrl: `${process.env.EPOCH_REDIRECT_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://blabber.ai'}/epoch-callback?type=credit${returnUrl ? `&returnUrl=${encodeURIComponent(returnUrl)}` : ''}`,
    });

    return NextResponse.json({ paymentUrl });
  } catch (error) {
    console.error('Error creating Epoch credit payment link:', error);
    return NextResponse.json(
      { error: 'Failed to create payment link' },
      { status: 500 }
    );
  }
}

