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
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { postId, messageId, amountCents } = await request.json();

    if ((!postId && !messageId) || !amountCents) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (amountCents <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    let creatorId: string;
    if (messageId) {
      // Get the message and conversation
      const { data: msg, error: msgError } = await supabase
        .from('messages')
        .select('id, conversation_id, PPV_price')
        .eq('id', messageId)
        .single();
      if (msgError || !msg) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 });
      }
      // Get the conversation and creator
      const { data: conv, error: convError } = await supabase
        .from('conversations')
        .select('id, participants:conversation_participants(user_id, profiles:profiles(*))')
        .eq('id', msg.conversation_id)
        .single();
      if (convError || !conv) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }
      // Find the creator participant
      const creatorProfile = (conv.participants || []).map((p: any) => p.profiles).find((p: any) => p.id !== session.user.id);
      if (!creatorProfile) {
        return NextResponse.json({ error: 'Creator not found in conversation' }, { status: 404 });
      }
      creatorId = creatorProfile.id;
    } else {
      // Get the post and creator details
      const { data: post, error: postError } = await supabase
        .from('posts')
        .select(`
          id,
          user_id,
          ppv_price_cents,
          profiles:user_id (
            id,
            username,
            full_name
          )
        `)
        .eq('id', postId)
        .single();

      if (postError || !post) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      creatorId = post.user_id;
    }

    // Calculate payment splits (includes any agency cut)
    const { creatorShare, platformShare, agencyShare, agencyProfileId } =
      await calculatePaymentSplits(amountCents, creatorId);

    // Platform collects the full amount; creator/agency shares are recorded in metadata / DB.
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      payment_method_types: ['card'],
      metadata: {
        postId: postId || '',
        messageId: messageId || '',
        userId: session.user.id,
        creatorId: creatorId || '',
        creatorShare: String(creatorShare),
        platformShare: String(platformShare),
        agencyShare: String(agencyShare),
        agencyProfileId: agencyProfileId || '',
      },
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Error creating PPV payment intent:', error);
    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    );
  }
} 