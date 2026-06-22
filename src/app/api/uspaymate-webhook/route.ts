import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { verifyUsPaymateWebhook } from '@/lib/payments/uspaymate';
import { finalizeUsPaymateOrder } from '@/lib/payments/uspaymate-finalize';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

interface UsPaymateWebhookPayload {
  order_key?: string;
  payment_intent_id?: string;
  status?: string;
}

export async function POST(request: Request) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (err) {
    console.error('[uspaymate-webhook] failed to read body:', err);
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const sharedSecret = process.env.USPAYMATE_SHARED_SECRET?.trim() || '';
  const signatureHeader = request.headers.get('X-Webhook-Signature');

  if (sharedSecret) {
    const valid = await verifyUsPaymateWebhook(sharedSecret, rawBody, signatureHeader);
    if (!valid) {
      console.error('[uspaymate-webhook] invalid signature');
      return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
    }
  } else {
    console.warn('[uspaymate-webhook] USPAYMATE_SHARED_SECRET not set — skipping verification');
  }

  let payload: UsPaymateWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as UsPaymateWebhookPayload;
  } catch (_) {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const { order_key: orderKey, payment_intent_id: paymentIntentId, status } = payload;
  if (!orderKey || !paymentIntentId) {
    return NextResponse.json({ error: 'missing order_key or payment_intent_id' }, { status: 400 });
  }

  if (status !== 'paid') {
    return NextResponse.json({ received: true, status });
  }

  const result = await finalizeUsPaymateOrder(supabaseAdmin, orderKey, paymentIntentId);
  if (!result.ok) {
    console.error('[uspaymate-webhook] finalize failed:', orderKey, result.error);
    return NextResponse.json({ error: result.error || 'finalize failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true, fulfilled: !result.alreadyFulfilled });
}
