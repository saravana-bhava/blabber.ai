import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
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

    const { amount, userId, credits, returnUrl } = await request.json();

    if (!amount || !userId || !credits) {
      return NextResponse.json(
        { error: 'Amount, userId, and credits are required' },
        { status: 400 }
      );
    }

    if (userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const amountCents = Math.round(amount);
    const customer = await getUsPaymateCustomerFromSession(
      supabase,
      session.user.id,
      session.user.email
    );

    const metadata: UsPaymatePaymentMetadata = {
      userId,
      transactionType: 'credit',
      amountCents,
      credits: credits.toString(),
    };

    const { paymentUrl } = await startUsPaymateCheckout(supabaseAdmin, {
      userId,
      userEmail: customer.email,
      userName: customer.name,
      callbackType: 'credit',
      returnUrl,
      amountCents,
      lineItems: [
        {
          name: `${credits} credits`,
          quantity: 1,
          price_minor: amountCents,
          line_total_minor: amountCents,
        },
      ],
      metadata,
    });

    return NextResponse.json({ paymentUrl });
  } catch (error) {
    console.error('Error creating USPaymate credit checkout:', error);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
