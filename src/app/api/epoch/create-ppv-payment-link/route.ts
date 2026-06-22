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

    const { postId, messageId, amountCents, returnUrl } = await request.json();

    if ((!postId && !messageId) || !amountCents) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let creatorId: string;
    if (messageId) {
      // Get the message and conversation
      const { data: msg, error: msgError } = await supabase
        .from('messages')
        .select('id, conversation_id, PPV_price, sender_id')
        .eq('id', messageId)
        .single();
      
      if (msgError || !msg) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 });
      }
      
      creatorId = msg.sender_id;
    } else {
      // Get the post and creator details
      const { data: post, error: postError } = await supabase
        .from('posts')
        .select('id, user_id, ppv_price_cents')
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

    // Create metadata for the payment
    const metadata: EpochPaymentMetadata = {
      userId: session.user.id,
      transactionType: 'ppv',
      postId: postId || undefined,
      messageId: messageId || undefined,
      creatorId,
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
      redirectUrl: `${process.env.EPOCH_REDIRECT_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://blabber.ai'}/epoch-callback?type=ppv${returnUrl ? `&returnUrl=${encodeURIComponent(returnUrl)}` : ''}`,
    });

    return NextResponse.json({ paymentUrl });
  } catch (error) {
    console.error('Error creating Epoch PPV payment link:', error);
    return NextResponse.json(
      { error: 'Failed to create payment link' },
      { status: 500 }
    );
  }
}
