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

    const { creatorId, returnUrl } = await request.json();

    if (!creatorId) {
      return NextResponse.json({ error: 'Missing creatorId' }, { status: 400 });
    }

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

    const { creatorShare, platformShare, agencyShare, agencyProfileId } =
      await calculatePaymentSplits(creator.subscription_price_cents, creatorId);

    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('follower_id', session.user.id)
      .eq('following_id', creatorId)
      .maybeSingle();

    const customer = await getUsPaymateCustomerFromSession(
      supabase,
      session.user.id,
      session.user.email
    );

    const amountCents = creator.subscription_price_cents;
    const intervalLabel =
      creator.subscription_interval === 'month' ? 'Monthly subscription' : 'Yearly subscription';

    const metadata: UsPaymatePaymentMetadata = {
      userId: session.user.id,
      transactionType: 'subscription',
      creatorId,
      amountCents,
      creatorShareCents: creatorShare,
      platformShareCents: platformShare,
      agencyShareCents: agencyShare,
      agencyProfileId,
      subscriptionId: existingSubscription?.id || undefined,
    };

    const { paymentUrl } = await startUsPaymateCheckout(supabaseAdmin, {
      userId: session.user.id,
      userEmail: customer.email,
      userName: customer.name,
      callbackType: 'subscription',
      returnUrl,
      amountCents,
      lineItems: [
        {
          name: intervalLabel,
          quantity: 1,
          price_minor: amountCents,
          line_total_minor: amountCents,
        },
      ],
      metadata,
    });

    return NextResponse.json({ paymentUrl });
  } catch (error) {
    console.error('Error creating USPaymate subscription checkout:', error);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
