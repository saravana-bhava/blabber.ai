import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import Stripe from 'stripe';
import { createTipNotification } from '@/app/actions/notificationActions';
import { assertAdminTestBypassAllowed } from '@/lib/payments/require-admin-test-bypass';

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

    const { postId, creatorId, paymentIntentId, amountCents, isDemo, adminTestBypass } =
      await request.json();

    if ((!postId && !creatorId) || !amountCents) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const adminDenied = await assertAdminTestBypassAllowed(supabase, session.user.id, adminTestBypass);
    if (adminDenied) return adminDenied;

    const effectivePaymentIntentId = adminTestBypass
      ? `admin_test_tip_${Date.now()}`
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
      // Demo / admin test: skip Stripe verification and use computed shares

      // For demo transactions, calculate shares directly (90% creator, 10% platform)
      creatorShareCents = Math.floor(amountCents * 0.9);
      platformShareCents = amountCents - creatorShareCents;
    } else {
      // Regular mode: verify the payment intent with Stripe
      paymentIntent = await stripe.paymentIntents.retrieve(effectivePaymentIntentId);
      
      if (paymentIntent.status !== 'succeeded') {
        return NextResponse.json({ error: 'Payment not successful' }, { status: 400 });
      }
      
      creatorShareCents = parseInt(paymentIntent.metadata.creatorShare || '0');
      platformShareCents = parseInt(paymentIntent.metadata.platformShare || '0');
      agencyShareCents = parseInt(paymentIntent.metadata.agencyShare || '0') || 0;
      agencyProfileId = paymentIntent.metadata.agencyProfileId || null;
    }

    const transactionData = {
      user_id: session.user.id,
      post_id: postId || null,
      creator_id: creatorId || null,
      amount_cents: amountCents,
      payment_intent_id: effectivePaymentIntentId,
      status: 'succeeded',
      payment_provider: paymentProvider,
      provider_transaction_reference: effectivePaymentIntentId,
      creator_share_cents: creatorShareCents,
      platform_share_cents: platformShareCents,
      agency_share_cents: agencyShareCents > 0 ? agencyShareCents : null,
      agency_profile_id: agencyProfileId || null,
    };

    // Create tip transaction record
    const { error: transactionError } = await supabase
      .from('tip_transactions')
      .insert(transactionData);

    if (transactionError) {
      console.error('Error creating tip transaction:', transactionError);
      return NextResponse.json({ error: 'Failed to create transaction record', details: transactionError }, { status: 500 });
    }

    // Create tip notification
    try {
      // Get the tipper's profile information
      const { data: tipperProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', session.user.id)
        .single();

      // Get the creator's ID (either from post or direct creatorId)
      let creatorUserId = creatorId;
      if (postId && !creatorId) {
        const { data: postData } = await supabase
          .from('posts')
          .select('user_id')
          .eq('id', postId)
          .single();
        creatorUserId = postData?.user_id;
      }

      if (creatorUserId && tipperProfile?.username) {
        await createTipNotification({
          creatorId: creatorUserId,
          tipperId: session.user.id,
          tipperUsername: tipperProfile.username,
          amount: amountCents / 100, // Convert cents to dollars
          postId: postId || undefined
        });
      }
    } catch (notificationError) {
      console.error('Failed to create tip notification:', notificationError);
      // Don't fail the transaction if notification fails
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in create-tip-transaction:', error);
    return NextResponse.json({ error: 'Internal server error', details: error }, { status: 500 });
  }
} 