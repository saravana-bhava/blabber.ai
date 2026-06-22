/**
 * USPaymate hosted checkout integration.
 * API docs: POST /v1/checkout/sessions → paylink redirect; webhook + reconcile finalize orders.
 */

import { createHmac, timingSafeEqual, webcrypto } from 'node:crypto';

const USPAYMATE_API_BASE =
  process.env.USPAYMATE_API_BASE?.trim() || 'https://api.uspaymate.net';
const USPAYMATE_CLIENT_KEY = process.env.USPAYMATE_CLIENT_KEY?.trim() || '';
const USPAYMATE_SHARED_SECRET = process.env.USPAYMATE_SHARED_SECRET?.trim() || '';
const USPAYMATE_REDIRECT_BASE_URL =
  process.env.USPAYMATE_REDIRECT_BASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  'https://blabber.ai';

export type UsPaymateTransactionType =
  | 'tip'
  | 'ppv'
  | 'subscription'
  | 'credit'
  | 'product';

export interface UsPaymatePaymentMetadata {
  userId: string;
  transactionType: UsPaymateTransactionType;
  postId?: string;
  messageId?: string;
  creatorId?: string;
  productId?: string;
  subscriptionId?: string;
  amountCents: number;
  creatorShareCents?: number;
  platformShareCents?: number;
  agencyShareCents?: number;
  agencyProfileId?: string | null;
  credits?: string;
  shippingAddress?: string;
  [key: string]: unknown;
}

export interface UsPaymateLineItem {
  name: string;
  quantity: number;
  price_minor: number;
  line_total_minor?: number;
}

export interface UsPaymateCouponLine {
  code: string;
  discount_minor: number;
}

export interface UsPaymateCustomer {
  email: string;
  name: string;
  phone?: string;
}

export interface UsPaymateBillingAddress {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postal_code: string;
  country: string;
}

export interface UsPaymateCheckoutSessionParams {
  orderKey: string;
  orderId?: number;
  amountMinor: number;
  currency?: string;
  lineItems: UsPaymateLineItem[];
  shippingTotalMinor?: number;
  taxTotalMinor?: number;
  couponLines?: UsPaymateCouponLine[];
  customer: UsPaymateCustomer;
  billingAddress?: UsPaymateBillingAddress;
  callbackType: string;
  returnUrl?: string;
}

export interface UsPaymateCheckoutSessionResult {
  paylink: string;
  orderKey: string;
  alreadyPaid?: boolean;
}

function authHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Client-Key': USPAYMATE_CLIENT_KEY,
    Authorization: `Bearer ${USPAYMATE_SHARED_SECRET}`,
  };
}

export function getUsPaymateRedirectBaseUrl(): string {
  return USPAYMATE_REDIRECT_BASE_URL.replace(/\/$/, '');
}

export function getUsPaymateWebhookUrl(): string {
  return `${getUsPaymateRedirectBaseUrl()}/api/uspaymate-webhook`;
}

export function generateUsPaymateOrderKey(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 8);
  return `ord_${stamp}_${suffix}`;
}

export function buildUsPaymateReturnUrl(
  orderKey: string,
  callbackType: string,
  returnUrl?: string
): string {
  const base = getUsPaymateRedirectBaseUrl();
  const url = new URL(`${base}/uspaymate-callback`);
  url.searchParams.set('order_key', orderKey);
  url.searchParams.set('type', callbackType);
  if (returnUrl) url.searchParams.set('returnUrl', returnUrl);
  return url.toString();
}

export async function verifyUsPaymateWebhook(
  sharedSecret: string,
  rawBody: string | Buffer,
  signatureHeader: string | null
): Promise<boolean> {
  if (!signatureHeader?.startsWith('sha256=')) return false;
  const enc = new TextEncoder();
  const baseKey = await webcrypto.subtle.importKey(
    'raw',
    enc.encode(sharedSecret),
    'HKDF',
    false,
    ['deriveBits']
  );
  const bits = await webcrypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(),
      info: enc.encode('halo-armor-webhook-v1'),
    },
    baseKey,
    256
  );
  const expected = createHmac('sha256', Buffer.from(bits))
    .update(rawBody)
    .digest('hex');
  const received = Buffer.from(signatureHeader.slice(7), 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  return (
    received.length === expectedBuf.length && timingSafeEqual(received, expectedBuf)
  );
}

export async function createUsPaymateCheckoutSession(
  params: UsPaymateCheckoutSessionParams
): Promise<UsPaymateCheckoutSessionResult> {
  if (!USPAYMATE_CLIENT_KEY) throw new Error('USPAYMATE_CLIENT_KEY must be set');
  if (!USPAYMATE_SHARED_SECRET) throw new Error('USPAYMATE_SHARED_SECRET must be set');

  const returnUrl = buildUsPaymateReturnUrl(
    params.orderKey,
    params.callbackType,
    params.returnUrl
  );

  const payload: Record<string, unknown> = {
    order_key: params.orderKey,
    amount_minor: params.amountMinor,
    currency: (params.currency || 'USD').toUpperCase(),
    line_items: params.lineItems,
    shipping_total_minor: params.shippingTotalMinor ?? 0,
    tax_total_minor: params.taxTotalMinor ?? 0,
    coupon_lines: params.couponLines ?? [],
    customer: params.customer,
    customer_country: 'US',
    return_url: returnUrl,
    webhook_url: getUsPaymateWebhookUrl(),
  };

  if (params.orderId != null) payload.order_id = params.orderId;
  if (params.billingAddress) payload.billing_address = params.billingAddress;

  const url = `${USPAYMATE_API_BASE.replace(/\/$/, '')}/v1/checkout/sessions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({} as Record<string, unknown>));

  if (res.status === 409) {
    return { paylink: returnUrl, orderKey: params.orderKey, alreadyPaid: true };
  }

  if (!res.ok) {
    const message =
      (typeof data.message === 'string' && data.message) ||
      (typeof data.error === 'string' && data.error) ||
      `HTTP ${res.status}`;
    throw new Error(message);
  }

  const paylink = data.paylink;
  if (typeof paylink !== 'string' || !paylink.startsWith('http')) {
    throw new Error('USPaymate response did not include a valid paylink');
  }

  return { paylink, orderKey: params.orderKey };
}

export async function fulfillUsPaymateSession(orderKey: string): Promise<void> {
  if (!USPAYMATE_CLIENT_KEY || !USPAYMATE_SHARED_SECRET) return;

  const url = `${USPAYMATE_API_BASE.replace(/\/$/, '')}/v1/checkout/sessions/fulfill`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ order_key: orderKey }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[uspaymate] fulfill failed:', orderKey, res.status, text);
    }
  } catch (err) {
    console.error('[uspaymate] fulfill error:', orderKey, err);
  }
}

export type UsPaymateReconcileStatus = 'paid' | 'active' | 'expired' | 'unknown';

export interface UsPaymateReconcileResult {
  status: UsPaymateReconcileStatus;
  payment_intent_id?: string;
}

export async function reconcileUsPaymateSessions(
  orderKeys: string[]
): Promise<Record<string, UsPaymateReconcileResult>> {
  if (!USPAYMATE_CLIENT_KEY) throw new Error('USPAYMATE_CLIENT_KEY must be set');
  if (!USPAYMATE_SHARED_SECRET) throw new Error('USPAYMATE_SHARED_SECRET must be set');

  const url = `${USPAYMATE_API_BASE.replace(/\/$/, '')}/v1/checkout/sessions/reconcile`;
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ order_keys: orderKeys }),
  });

  const data = await res.json().catch(() => ({} as { results?: Record<string, UsPaymateReconcileResult> }));
  if (!res.ok) {
    throw new Error(`USPaymate reconcile failed: HTTP ${res.status}`);
  }

  return data.results || {};
}

export async function checkUsPaymateStatus(): Promise<boolean> {
  if (!USPAYMATE_CLIENT_KEY || !USPAYMATE_SHARED_SECRET) return false;
  const url = `${USPAYMATE_API_BASE.replace(/\/$/, '')}/v1/status`;
  const res = await fetch(url, { method: 'GET', headers: authHeaders() });
  return res.ok;
}
