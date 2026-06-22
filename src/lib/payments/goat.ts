/**
 * GOAT Payments (https://goatpayments.com) integration.
 *
 * Wired to the documented surface at https://developers.goatpaymentsdashboard.com:
 *
 *   - Auth:        Authorization: Bearer <GOAT_API_KEY>
 *   - Sale:        POST /payment/sale          (charge now)
 *   - Auth-only:   POST /payment/auth          (capture later)
 *   - Capture:     POST /payment/{id}/capture
 *   - Fetch:       GET  /payment/{id}
 *   - 3DS create:  POST /3ds/create
 *   - 3DS check:   GET  /3ds/{id}/check
 *
 * Request bodies are application/x-www-form-urlencoded with dotted keys
 * (e.g. `card.number`, `terminal.id`). Responses are JSON; the transaction id
 * is top-level (`id`) and the lifecycle state lives in `status.status` with a
 * human-readable reason in `status.reason`.
 *
 * Unconfirmed pieces (verify against your account once you can place a live
 * test transaction; each is marked TODO inline):
 *   - Whether `amount` is in cents or major units (defaulting to major-unit
 *     decimal string, e.g. "10.00", which matches every other US card API
 *     I've seen with a `terminal.id` field).
 *   - The literal value of `source` (defaulting to "internet"; the docs flag it
 *     as required but don't enumerate values).
 *   - Whether `level` is a number/string and which value matches Level I data
 *     (defaulting to "1").
 *   - Exact card status enum values returned in `status.status` (we accept the
 *     usual approved/captured/sale variants).
 */

const GOAT_API_BASE =
  process.env.GOAT_API_ENDPOINT?.trim() || 'https://api.goatpaymentsdashboard.com';
const GOAT_API_KEY = process.env.GOAT_API_KEY?.trim() || '';
const GOAT_TERMINAL_ID = process.env.GOAT_TERMINAL_ID?.trim() || '';
const GOAT_LEVEL = process.env.GOAT_LEVEL?.trim() || '1';
const GOAT_SOURCE = process.env.GOAT_SOURCE?.trim() || 'internet';

export type GoatTransactionType = 'tip' | 'ppv' | 'subscription' | 'credit' | 'product';

export interface GoatPaymentMetadata {
  userId: string;
  transactionType: GoatTransactionType;
  postId?: string;
  messageId?: string;
  creatorId?: string;
  productId?: string;
  subscriptionId?: string;
  amountCents: number;
  creatorShareCents?: number;
  platformShareCents?: number;
  credits?: string;
  shippingAddress?: string;
  [key: string]: unknown;
}

export interface GoatCardInput {
  number: string;
  exp_month: string;
  exp_year: string;
  cvc: string;
  /** Cardholder name. Optional but recommended; falls back to billing first/last. */
  name?: string;
}

export interface GoatBillingInput {
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface GoatProcessPaymentParams {
  amountCents: number;
  currency?: string;
  metadata: GoatPaymentMetadata;
  card: GoatCardInput;
  billing?: GoatBillingInput;
  /** Optional 3DS authentication id from a prior /3ds/create + /3ds/{id}/check flow. */
  threedsId?: string;
  /** Customer IP — set from request in the API route. */
  customer_ip?: string;
  /** Whether to email the buyer a receipt. Maps to `sendReceipt`. */
  send_receipt?: boolean;
  /** Override per-call: 'sale' (default, charge now) or 'auth' (auth-only, capture later). */
  capture?: 'sale' | 'auth';
}

export interface GoatProcessPaymentResult {
  success: boolean;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  transaction_id?: string;
  message?: string;
}

export interface GoatStatusResult {
  success: boolean;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  transaction_id?: string;
  message?: string;
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${GOAT_API_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  };
}

/** Combine MM and YY/YYYY into the `card.exp` shape GOAT examples use (MMYY). */
function formatCardExp(month: string, year: string): string {
  const mm = month.replace(/\D/g, '').slice(0, 2).padStart(2, '0');
  const yyDigits = year.replace(/\D/g, '');
  const yy = yyDigits.length >= 4 ? yyDigits.slice(-2) : yyDigits.padStart(2, '0');
  return `${mm}${yy}`;
}

/**
 * Build an x-www-form-urlencoded body from a flat map of dotted-key fields.
 * URLSearchParams preserves `.` in keys (per the WHATWG URL form-encoded
 * serializer's percent-encode set), so `card.number` lands on the wire as
 * `card.number=4242…` not `card%2Enumber=…`.
 */
function encodeForm(fields: Record<string, string | number | boolean | undefined | null>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === '') continue;
    params.append(key, String(value));
  }
  return params.toString();
}

/**
 * Map our normalized response to a final lifecycle state. The exact case-sensitive
 * spellings GOAT returns for cards aren't enumerated in the public docs (the ACH
 * table is — Voided/Hold/Pending/Submitted), so we accept the usual variants.
 *
 * - SUCCESS: approved / captured / sale / settled / paid / batched
 * - PENDING: pending / submitted / hold / processing / queued
 * - FAILED:  everything else
 */
function classifyStatus(raw: string | undefined): 'SUCCESS' | 'PENDING' | 'FAILED' {
  const v = (raw || '').toLowerCase();
  if (!v) return 'FAILED';
  if (/(approved|captured|sale|settled|paid|batched|completed)/.test(v)) return 'SUCCESS';
  if (/(pending|submitted|hold|processing|queued|authorized)/.test(v)) return 'PENDING';
  return 'FAILED';
}

interface GoatRawTransaction {
  id?: string;
  status?: { status?: string; reason?: string };
  batch?: unknown;
  message?: string;
  error?: string;
  errors?: unknown;
}

function parseTransaction(raw: GoatRawTransaction): {
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  transactionId: string | undefined;
  message: string | undefined;
} {
  const id = raw.id;
  const statusEnum = raw.status?.status;
  const reason = raw.status?.reason;
  const status = classifyStatus(statusEnum);
  const message = reason || raw.message || raw.error;
  return { status, transactionId: id, message };
}

/** Process a one-time card charge. */
export async function processGoatPayment(
  params: GoatProcessPaymentParams
): Promise<GoatProcessPaymentResult> {
  if (!GOAT_API_KEY) throw new Error('GOAT_API_KEY must be set');
  if (!GOAT_TERMINAL_ID) throw new Error('GOAT_TERMINAL_ID must be set');

  const card = params.card;
  const number = (card.number || '').replace(/\s/g, '');
  const exp = formatCardExp(card.exp_month || '', card.exp_year || '');
  const billing: Partial<GoatBillingInput> = params.billing || {};

  const cardholderName =
    card.name?.trim() ||
    [billing.first_name?.trim(), billing.last_name?.trim()].filter(Boolean).join(' ') ||
    'Cardholder';

  // TODO(amount-units): docs only say `amount` is required, not whether it is
  // major units (e.g. "10.00") or minor units (1000 cents). Defaulting to a
  // 2-decimal major-unit string. If the live gateway rejects, change to:
  //   amount: String(params.amountCents),
  const amount = (params.amountCents / 100).toFixed(2);

  const fields: Record<string, string | number | boolean | undefined | null> = {
    'terminal.id': GOAT_TERMINAL_ID,
    amount,
    currency: (params.currency || 'USD').toUpperCase(),
    source: GOAT_SOURCE,
    level: GOAT_LEVEL,

    'card.name': cardholderName,
    'card.number': number,
    'card.exp': exp,
    'card.cvv': card.cvc,

    'contact.email': billing.email?.trim() || undefined,
    'contact.phone': billing.phone_number?.trim() || undefined,

    'address.line1': billing.address?.trim() || undefined,
    'address.city': billing.city?.trim() || undefined,
    'address.state': billing.state?.trim() || undefined,
    'address.zip': billing.zip?.trim() || undefined,
    'address.country': billing.country
      ? billing.country.toUpperCase().slice(0, 2)
      : 'US',

    sendReceipt: params.send_receipt ? 'true' : undefined,

    // Optional client IP for risk scoring. Field name is a guess — GOAT may use
    // `client.ip`, `customer.ip`, or none at all. Safe to send as a no-op extra.
    'customer.ip': params.customer_ip || undefined,

    // 3DS hand-off — populated when the frontend already completed
    // /3ds/create + /3ds/{id}/check and has a threeds.id to attach.
    'threeds.id': params.threedsId || undefined,
  };

  // Free-form metadata pass-through. GOAT may or may not echo this back; we
  // store it on our side regardless so it's fine if the gateway ignores it.
  fields['metadata.transaction_type'] = params.metadata.transactionType;
  fields['metadata.user_id'] = params.metadata.userId;
  if (params.metadata.creatorId) fields['metadata.creator_id'] = params.metadata.creatorId;
  if (params.metadata.postId) fields['metadata.post_id'] = params.metadata.postId;
  if (params.metadata.messageId) fields['metadata.message_id'] = params.metadata.messageId;
  if (params.metadata.productId) fields['metadata.product_id'] = params.metadata.productId;

  const path = params.capture === 'auth' ? '/payment/auth' : '/payment/sale';
  const url = `${GOAT_API_BASE.replace(/\/$/, '')}${path}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: encodeForm(fields),
  });

  const data = await res.json().catch(() => ({} as GoatRawTransaction));

  if (!res.ok) {
    const message =
      (data as GoatRawTransaction).status?.reason ||
      (data as GoatRawTransaction).message ||
      (data as GoatRawTransaction).error ||
      `HTTP ${res.status}`;
    return { success: false, status: 'FAILED', message };
  }

  const { status, transactionId, message } = parseTransaction(data as GoatRawTransaction);
  return {
    success: status === 'SUCCESS',
    status,
    transaction_id: transactionId,
    message,
  };
}

/** Fetch the latest state of a transaction (`GET /payment/{id}`). */
export async function checkGoatPaymentStatus(
  transactionId: string
): Promise<GoatStatusResult> {
  if (!GOAT_API_KEY) throw new Error('GOAT_API_KEY must be set');

  const url = `${GOAT_API_BASE.replace(/\/$/, '')}/payment/${encodeURIComponent(transactionId)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${GOAT_API_KEY}`,
      Accept: 'application/json',
    },
  });

  const data = await res.json().catch(() => ({} as GoatRawTransaction));

  if (!res.ok) {
    const message =
      (data as GoatRawTransaction).status?.reason ||
      (data as GoatRawTransaction).message ||
      (data as GoatRawTransaction).error ||
      `HTTP ${res.status}`;
    return { success: false, status: 'FAILED', message };
  }

  const { status, transactionId: id, message } = parseTransaction(data as GoatRawTransaction);
  return {
    success: status === 'SUCCESS',
    status,
    transaction_id: id || transactionId,
    message,
  };
}

/**
 * Capture a previously authorized transaction (created with capture: 'auth').
 * Returns the raw GoatProcessPaymentResult shape so callers can treat it the
 * same as a fresh sale.
 */
export async function captureGoatPayment(
  authTransactionId: string,
  amountCents?: number
): Promise<GoatProcessPaymentResult> {
  if (!GOAT_API_KEY) throw new Error('GOAT_API_KEY must be set');

  const url = `${GOAT_API_BASE.replace(/\/$/, '')}/payment/${encodeURIComponent(authTransactionId)}/capture`;
  const fields: Record<string, string | number | undefined> = {};
  if (typeof amountCents === 'number') {
    fields.amount = (amountCents / 100).toFixed(2);
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: encodeForm(fields),
  });

  const data = await res.json().catch(() => ({} as GoatRawTransaction));
  if (!res.ok) {
    const message =
      (data as GoatRawTransaction).status?.reason ||
      (data as GoatRawTransaction).message ||
      (data as GoatRawTransaction).error ||
      `HTTP ${res.status}`;
    return { success: false, status: 'FAILED', message };
  }
  const { status, transactionId, message } = parseTransaction(data as GoatRawTransaction);
  return {
    success: status === 'SUCCESS',
    status,
    transaction_id: transactionId || authTransactionId,
    message,
  };
}
