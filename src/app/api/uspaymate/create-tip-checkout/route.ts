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

    const { creatorId, postId, amountCents, returnUrl } = await request.json();

    if (!creatorId || !amountCents) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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
      transactionType: 'tip',
      postId: postId || undefined,
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
      callbackType: 'tip',
      returnUrl,
      amountCents,
      lineItems: [
        {
          name: 'Creator tip',
          quantity: 1,
          price_minor: amountCents,
          line_total_minor: amountCents,
        },
      ],
      metadata,
    });

    return NextResponse.json({ paymentUrl });
  } catch (error) {
    console.error('Error creating USPaymate tip checkout:', error);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
