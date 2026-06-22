import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { createEpochPaymentLink, EpochPaymentMetadata } from '@/lib/payments/epoch';
import { calculatePaymentSplits } from '@/lib/payments/calculate-splits';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { creatorId, returnUrl } = await request.json();

    if (!creatorId) {
      return NextResponse.json({ error: 'Missing creatorId' }, { status: 400 });
    }

    // Get creator's subscription details
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('subscription_price_cents, subscription_interval')
      .eq('profile_id', creatorId)
      .single();

    if (creatorError || !creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
    }

    if (!creator.subscription_price_cents || !creator.subscription_interval) {
      return NextResponse.json({ error: 'Creator has not set up subscription pricing' }, { status: 400 });
    }

    // Calculate payment splits (includes any agency cut)
    const { creatorShare, platformShare, agencyShare, agencyProfileId } =
      await calculatePaymentSplits(creator.subscription_price_cents, creatorId);

    // Check for existing subscription
    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('follower_id', session.user.id)
      .eq('following_id', creatorId)
      .single();

    // Create metadata for the payment
    const metadata: EpochPaymentMetadata = {
      userId: session.user.id,
      transactionType: 'subscription',
      creatorId,
      amountCents: creator.subscription_price_cents,
      creatorShareCents: creatorShare,
      platformShareCents: platformShare,
      agencyShareCents: agencyShare,
      agencyProfileId: agencyProfileId,
      subscriptionId: existingSubscription?.id || undefined,
    };

    // Create Epoch payment link with recurring parameters
    const paymentUrl = await createEpochPaymentLink({
      amount: creator.subscription_price_cents / 100, // Convert cents to dollars
      currency: 'USD',
      metadata,
      noUserPass: true,
      redirectUrl: `${process.env.EPOCH_REDIRECT_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://blabber.ai'}/epoch-callback?type=subscription${returnUrl ? `&returnUrl=${encodeURIComponent(returnUrl)}` : ''}`,
      recurring: {
        interval: creator.subscription_interval,
        intervalCount: 1,
      },
    });

    return NextResponse.json({ paymentUrl });
  } catch (error) {
    console.error('Error creating Epoch subscription payment link:', error);
    return NextResponse.json(
      { error: 'Failed to create payment link' },
      { status: 500 }
    );
  }
}
