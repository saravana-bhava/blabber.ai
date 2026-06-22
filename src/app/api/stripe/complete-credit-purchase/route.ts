import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
});

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const authClient = createClient(cookieStore);
    const {
      data: { session },
    } = await authClient.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { paymentIntentId } = await request.json();
    if (!paymentIntentId || typeof paymentIntentId !== 'string') {
      return NextResponse.json({ error: 'paymentIntentId required' }, { status: 400 });
    }

    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (pi.status !== 'succeeded') {
      return NextResponse.json({ error: 'Payment not completed' }, { status: 400 });
    }
    if (pi.metadata.type !== 'credit_purchase') {
      return NextResponse.json({ error: 'Invalid payment type' }, { status: 400 });
    }
    if (pi.metadata.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const credits = parseInt(pi.metadata.credits || '0', 10);
    if (!Number.isFinite(credits) || credits < 1) {
      return NextResponse.json({ error: 'Invalid credits metadata' }, { status: 400 });
    }

    const { data: existing } = await admin
      .from('credit_transactions')
      .select('id')
      .eq('provider_transaction_reference', paymentIntentId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ ok: true, alreadyFulfilled: true });
    }

    const { error: txErr } = await admin.from('credit_transactions').insert({
      user_id: session.user.id,
      amount_cents: pi.amount,
      credits_purchased: credits,
      currency: 'USD',
      payment_provider: 'stripe',
      status: 'succeeded',
      provider_transaction_reference: paymentIntentId,
    });
    if (txErr) {
      console.error('complete-credit-purchase insert error', txErr);
      return NextResponse.json({ error: 'Failed to record purchase' }, { status: 500 });
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('credits')
      .eq('id', session.user.id)
      .single();
    await admin
      .from('profiles')
      .update({ credits: (profile?.credits || 0) + credits })
      .eq('id', session.user.id);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('complete-credit-purchase', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
