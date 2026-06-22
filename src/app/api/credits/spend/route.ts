import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import {
  executeCreditSpendPurchase,
  type CreditSpendBody,
} from '@/lib/payments/credit-spend-execute';
import type { CreditSpendRequest } from '@/lib/payments/credit-spend-types';

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

    const { idempotency_key, ...rest } = (await request.json()) as CreditSpendRequest & { idempotency_key?: string };
    const body = rest as CreditSpendRequest;

    if (!body?.kind) {
      return NextResponse.json({ error: 'Missing kind' }, { status: 400 });
    }

    const admin = createServiceRoleClient();

    // Return cached result for client retries — prevents double-charges on network timeout.
    if (idempotency_key) {
      const { data: cached } = await admin
        .from('credit_idempotency_keys')
        .select('result')
        .eq('user_id', user.id)
        .eq('idem_key', idempotency_key)
        .maybeSingle();
      if (cached) {
        return NextResponse.json(cached.result);
      }
    }

    const result = await executeCreditSpendPurchase(user.id, body as CreditSpendBody);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.status }
      );
    }

    const successPayload = { success: true, creditsCharged: result.creditsCharged };

    if (idempotency_key) {
      await admin
        .from('credit_idempotency_keys')
        .upsert(
          { user_id: user.id, idem_key: idempotency_key, result: successPayload },
          { onConflict: 'user_id,idem_key', ignoreDuplicates: true }
        );
    }

    return NextResponse.json(successPayload);
  } catch (e) {
    console.error('/api/credits/spend', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
