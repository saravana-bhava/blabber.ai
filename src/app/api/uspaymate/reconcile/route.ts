import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { reconcileUsPaymateSessions } from '@/lib/payments/uspaymate';
import { finalizeUsPaymateOrder } from '@/lib/payments/uspaymate-finalize';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { order_key: orderKey } = body as { order_key?: string };
    if (!orderKey) {
      return NextResponse.json({ error: 'order_key required' }, { status: 400 });
    }

    const { data: pending } = await supabaseAdmin
      .from('pending_uspaymate_payments')
      .select('id')
      .eq('order_key', orderKey)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!pending) {
      return NextResponse.json({ status: 'success', alreadyFulfilled: true });
    }

    const maxAttempts = 3;
    const delayMs = 2500;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const results = await reconcileUsPaymateSessions([orderKey]);
      const result = results[orderKey];

      if (result?.status === 'paid' && result.payment_intent_id) {
        const finalize = await finalizeUsPaymateOrder(
          supabaseAdmin,
          orderKey,
          result.payment_intent_id
        );
        if (finalize.ok) {
          return NextResponse.json({ status: 'success', payment_intent_id: result.payment_intent_id });
        }
        return NextResponse.json({ error: finalize.error || 'Failed to finalize' }, { status: 500 });
      }

      if (result?.status === 'expired') {
        await supabaseAdmin.from('pending_uspaymate_payments').delete().eq('order_key', orderKey);
        return NextResponse.json({ status: 'expired' });
      }

      if (attempt < maxAttempts) {
        await sleep(delayMs);
      }
    }

    return NextResponse.json({ status: 'active' });
  } catch (err) {
    console.error('[uspaymate/reconcile] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
