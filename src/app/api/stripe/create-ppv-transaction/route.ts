import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import Stripe from 'stripe';
import { createPPVPurchaseNotification } from '@/app/actions/notificationActions';
import { assertAdminTestBypassAllowed } from '@/lib/payments/require-admin-test-bypass';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
});

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { postId, messageId, paymentIntentId, isDemo, adminTestBypass } = await request.json();

    if (!postId && !messageId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const adminDenied = await assertAdminTestBypassAllowed(supabase, session.user.id, adminTestBypass);
    if (adminDenied) return adminDenied;

    const effectivePaymentIntentId = adminTestBypass
      ? `admin_test_ppv_${Date.now()}`
      : paymentIntentId;
    if (!effectivePaymentIntentId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const skipStripe =
      !!adminTestBypass || isDemo || effectivePaymentIntentId.startsWith('demo_');
    const paymentProvider = adminTestBypass ? 'admin_test' : skipStripe ? 'demo' : 'stripe';

    let paymentIntent = null;
    let creatorShareCents = 0;
    let platformShareCents = 0;
    let agencyShareCents = 0;
    let agencyProfileId: string | null = null;

    if (skipStripe) {
    } else {
      paymentIntent = await stripe.paymentIntents.retrieve(effectivePaymentIntentId);
      if (paymentIntent.status !== 'succeeded') {
        return NextResponse.json({ error: 'Payment not successful' }, { status: 400 });
      }

      creatorShareCents = parseInt(paymentIntent.metadata.creatorShare || '0');
      platformShareCents = parseInt(paymentIntent.metadata.platformShare || '0');
      agencyShareCents = parseInt(paymentIntent.metadata.agencyShare || '0') || 0;
      agencyProfileId = paymentIntent.metadata.agencyProfileId || null;
    }

    if (messageId) {
      const { data: msg, error: msgError } = await supabase
        .from('messages')
        .select('id, conversation_id, PPV_price, sender_id')
        .eq('id', messageId)
        .single();
      if (msgError || !msg) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 });
      }
      const { data: conv, error: convError } = await supabase
        .from('conversations')
        .select('id, participants:conversation_participants(user_id, profiles:profiles(*))')
        .eq('id', msg.conversation_id)
        .single();
      if (convError || !conv) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }
      const creatorProfile = (conv.participants || [])
        .map((p: { profiles: unknown }) => p.profiles)
        .find((p) => (p as { id?: string } | null | undefined)?.id === msg.sender_id);
      if (!creatorProfile) {
        return NextResponse.json({ error: 'Creator not found in conversation' }, { status: 404 });
      }
      const amountCents = skipStripe ? msg.PPV_price : paymentIntent?.amount || 0;

      if (skipStripe) {
        creatorShareCents = Math.floor(amountCents * 0.9);
        platformShareCents = amountCents - creatorShareCents;
      }

      const { data: transactionData, error: transactionError } = await supabase
        .from('ppv_transactions')
        .insert({
          user_id: session.user.id,
          message_id: msg.id,
          amount_cents: amountCents,
          payment_intent_id: effectivePaymentIntentId,
          status: 'succeeded',
          payment_provider: paymentProvider,
          provider_transaction_reference: effectivePaymentIntentId,
          creator_share_cents: creatorShareCents,
          platform_share_cents: platformShareCents,
          agency_share_cents: agencyShareCents > 0 ? agencyShareCents : null,
          agency_profile_id: agencyProfileId || null,
        })
        .select('id')
        .single();
      if (transactionError || !transactionData) {
        console.error('Error creating PPV transaction:', transactionError);
        return NextResponse.json({ error: 'Failed to create transaction record' }, { status: 500 });
      }
      const { error: updateError } = await supabase
        .from('messages')
        .update({ PPV_transaction_id: transactionData.id })
        .eq('id', msg.id)
        .eq('sender_id', msg.sender_id);
      if (updateError) {
        console.error('Error updating message with PPV_transaction_id:', updateError);
        return NextResponse.json({ error: 'Failed to update message with transaction id' }, { status: 500 });
      }
      return NextResponse.json({ success: true, transactionId: transactionData.id });
    }

    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('ppv_price_cents, user_id')
      .eq('id', postId)
      .single();

    if (postError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    if (skipStripe) {
      creatorShareCents = Math.floor(post.ppv_price_cents * 0.9);
      platformShareCents = post.ppv_price_cents - creatorShareCents;
    }

    const { error: transactionError } = await supabase
      .from('ppv_transactions')
      .insert({
        user_id: session.user.id,
        post_id: postId,
        amount_cents: post.ppv_price_cents,
        payment_intent_id: effectivePaymentIntentId,
        status: 'succeeded',
        payment_provider: paymentProvider,
        provider_transaction_reference: effectivePaymentIntentId,
        creator_share_cents: creatorShareCents,
        platform_share_cents: platformShareCents,
        agency_share_cents: agencyShareCents > 0 ? agencyShareCents : null,
        agency_profile_id: agencyProfileId || null,
      });

    if (transactionError) {
      console.error('Error creating PPV transaction:', transactionError);
      return NextResponse.json({ error: 'Failed to create transaction record' }, { status: 500 });
    }

    try {
      const { data: buyerProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', session.user.id)
        .single();

      if (buyerProfile?.username) {
        await createPPVPurchaseNotification({
          creatorId: post.user_id,
          buyerId: session.user.id,
          buyerUsername: buyerProfile.username,
          postId: postId,
          amount: post.ppv_price_cents / 100,
        });
      }
    } catch (notificationError) {
      console.error('Failed to create PPV purchase notification:', notificationError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in create-ppv-transaction:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
