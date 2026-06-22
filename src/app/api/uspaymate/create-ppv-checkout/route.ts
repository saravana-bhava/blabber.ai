import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { calculatePaymentSplits } from '@/lib/payments/calculate-splits';
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
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { postId, messageId, amountCents, returnUrl } = await request.json();

    if ((!postId && !messageId) || !amountCents) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let creatorId: string;
    if (messageId) {
      const { data: msg, error: msgError } = await supabase
        .from('messages')
        .select('id, sender_id')
        .eq('id', messageId)
        .single();
      if (msgError || !msg) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 });
      }
      creatorId = msg.sender_id;
    } else {
      const { data: post, error: postError } = await supabase
        .from('posts')
        .select('id, user_id')
        .eq('id', postId)
        .single();
      if (postError || !post) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }
      creatorId = post.user_id;
    }

    const { creatorShare, platformShare, agencyShare, agencyProfileId } =
      await calculatePaymentSplits(amountCents, creatorId);

    const customer = await getUsPaymateCustomerFromSession(
      supabase,
      session.user.id,
      session.user.email
    );

    const metadata: UsPaymatePaymentMetadata = {
      userId: session.user.id,
      transactionType: 'ppv',
      postId: postId || undefined,
      messageId: messageId || undefined,
      creatorId,
      amountCents,
      creatorShareCents: creatorShare,
      platformShareCents: platformShare,
      agencyShareCents: agencyShare,
      agencyProfileId,
    };

    const { paymentUrl } = await startUsPaymateCheckout(supabaseAdmin, {
      userId: session.user.id,
      userEmail: customer.email,
      userName: customer.name,
      callbackType: 'ppv',
      returnUrl,
      amountCents,
      lineItems: [
        {
          name: messageId ? 'Pay-per-view message' : 'Pay-per-view content',
          quantity: 1,
          price_minor: amountCents,
          line_total_minor: amountCents,
        },
      ],
      metadata,
    });

    return NextResponse.json({ paymentUrl });
  } catch (error) {
    console.error('Error creating USPaymate PPV checkout:', error);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
