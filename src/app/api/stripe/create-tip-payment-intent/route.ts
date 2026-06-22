import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import Stripe from 'stripe';
import { calculatePaymentSplits } from '@/lib/payments/calculate-splits';

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

    const { postId, amountCents, creatorId } = await request.json();

    if (!amountCents) {
      return NextResponse.json({ error: 'Missing required amount' }, { status: 400 });
    }

    let creatorProfileIdForSplits: string | null = null;
    const metadata: Record<string, string> = {
      userId: session.user.id,
      type: 'tip',
    };

    if (postId) {
      const { data: post, error: postError } = await supabase
        .from('posts')
        .select('user_id')
        .eq('id', postId)
        .single();

      if (postError || !post) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      creatorProfileIdForSplits = post.user_id;
      metadata.postId = postId;
    } else if (creatorId) {
      creatorProfileIdForSplits = creatorId;
      metadata.creatorId = creatorId;
    } else {
      return NextResponse.json({ error: 'Either postId or creatorId must be provided' }, { status: 400 });
    }

    // Calculate payment splits (includes any agency cut)
    const { creatorShare, platformShare, agencyShare, agencyProfileId } =
      await calculatePaymentSplits(amountCents, creatorProfileIdForSplits);

    metadata.creatorShare = String(creatorShare);
    metadata.platformShare = String(platformShare);
    metadata.agencyShare = String(agencyShare);
    metadata.agencyProfileId = agencyProfileId || '';

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      payment_method_types: ['card'],
      metadata,
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Error in create-tip-payment-intent:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 