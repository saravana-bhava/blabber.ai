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

    const { postId, amountCents, creatorId, returnUrl } = await request.json();

    if (!amountCents) {
      return NextResponse.json({ error: 'Missing required amount' }, { status: 400 });
    }

    let effectiveCreatorId: string;
    if (postId) {
      // Get post and creator details
      const { data: post, error: postError } = await supabase
        .from('posts')
        .select('user_id')
        .eq('id', postId)
        .single();

      if (postError || !post) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }
      effectiveCreatorId = post.user_id;
    } else if (creatorId) {
      effectiveCreatorId = creatorId;
    } else {
      return NextResponse.json({ error: 'Either postId or creatorId must be provided' }, { status: 400 });
    }

    // Calculate payment splits (includes any agency cut)
    const { creatorShare, platformShare, agencyShare, agencyProfileId } =
      await calculatePaymentSplits(amountCents, effectiveCreatorId);

    // Create metadata for the payment
    const metadata: EpochPaymentMetadata = {
      userId: session.user.id,
      transactionType: 'tip',
      postId: postId || undefined,
      creatorId: effectiveCreatorId,
      amountCents,
      creatorShareCents: creatorShare,
      platformShareCents: platformShare,
      agencyShareCents: agencyShare,
      agencyProfileId: agencyProfileId,
    };

    // Create Epoch payment link
    const paymentUrl = await createEpochPaymentLink({
      amount: amountCents / 100, // Convert cents to dollars
      currency: 'USD',
      metadata,
      noUserPass: true,
      redirectUrl: `${process.env.EPOCH_REDIRECT_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://blabber.ai'}/epoch-callback?type=tip${returnUrl ? `&returnUrl=${encodeURIComponent(returnUrl)}` : ''}`,
    });

    return NextResponse.json({ paymentUrl });
  } catch (error) {
    console.error('Error creating Epoch tip payment link:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
