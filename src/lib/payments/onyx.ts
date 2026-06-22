/**
 * Onyx Processing payment integration
 * Based on onyx-live WooCommerce gateway: POST /api/payment/process, GET /api/transaction/status/:id
 */

const ONYX_API_BASE = process.env.ONYX_API_ENDPOINT || 'https://dashboard.onyxprocessing.com';
const ONYX_API_KEY = process.env.ONYX_API_KEY || '';
const ONYX_MERCHANT_ID = process.env.ONYX_MERCHANT_ID || '';
const ONYX_ENVIRONMENT = process.env.ONYX_ENVIRONMENT || 'live';

export type OnyxTransactionType = 'tip' | 'ppv' | 'subscription' | 'credit' | 'product';

export interface OnyxPaymentMetadata {
  userId: string;
  transactionType: OnyxTransactionType;
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

export interface OnyxCardInput {
  number: string;
  exp_month: string;
  exp_year: string;
  cvc: string;
}

export interface OnyxBillingInput {
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

export interface OnyxProcessPaymentParams {
  amountCents: number;
  currency?: string;
  metadata: OnyxPaymentMetadata;
  card: OnyxCardInput;
  billing?: OnyxBillingInput;
  /** If true and Onyx returns a payment_method_id, caller can store for rebilling */
  save_card?: boolean;
  /** For 3DS redirect - where to send user after auth */
  redirect_url?: string;
  /** Use stored payment method id instead of card (for rebilling) */
  payment_method_id?: string;
  /** Customer IP (for Onyx); set from request in API route */
  customer_ip?: string;
}

export interface OnyxProcessPaymentResult {
  success: boolean;
  status: 'SUCCESS' | 'REDIRECT' | 'FAILED';
  transaction_id?: string;
  redirect_url?: string;
  message?: string;
  /** If save_card was true and gateway returns a token for future use */
  payment_method_id?: string;
}

export interface OnyxStatusResult {
  success: boolean;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  transaction_id?: string;
  message?: string;
}

function getProcessEndpoint(): string {
  return `${ONYX_API_BASE.replace(/\/$/, '')}/api/payment/process`;
}

function getStatusEndpoint(transactionId: string): string {
  const base = ONYX_API_BASE.replace(/\/$/, '');
  return `${base}/api/transaction/status/${encodeURIComponent(transactionId)}`;
}

/**
 * Process a payment via Onyx (one-time charge or first subscription charge).
 * Card data must be sent from a secure server; do not log or store raw card numbers.
 */
export async function processOnyxPayment(params: OnyxProcessPaymentParams): Promise<OnyxProcessPaymentResult> {
  if (!ONYX_API_KEY || !ONYX_MERCHANT_ID) {
    throw new Error('ONYX_API_KEY and ONYX_MERCHANT_ID must be set');
  }

  const url = getProcessEndpoint();
  const card = params.card;
  const number = (card.number || '').replace(/\s/g, '');
  const expParts = (card.exp_month || '').split('/');
  const expMonth = expParts[0] || card.exp_month;
  const expYear = card.exp_year?.length === 2 ? `20${card.exp_year}` : card.exp_year;

  const billing: Partial<OnyxBillingInput> = params.billing || {};
  const body: Record<string, unknown> = {
    first_name: billing.first_name?.trim() || 'Customer',
    last_name: billing.last_name?.trim() || 'User',
    email: billing.email?.trim() ?? '',
    phone_number: (billing.phone_number?.trim() ?? '') || '1',
    address: (billing.address?.trim() ?? '') || 'N/A',
    city: (billing.city?.trim() ?? '') || 'N/A',
    state: (billing.state?.trim() ?? '') || 'N/A',
    zip: (billing.zip?.trim() ?? '') || '00000',
    country: (billing.country || 'US').toUpperCase().slice(0, 2),
    amount: params.amountCents,
    currency: (params.currency || 'USD').toUpperCase(),
    card_number: number,
    expiry_month: expMonth,
    expiry_year: expYear,
    cvv: card.cvc,
    merchant_id: ONYX_MERCHANT_ID,
    source_url: typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL || 'https://blabber.ai',
    environment: ONYX_ENVIRONMENT,
    redirect_url: params.redirect_url || `${process.env.NEXT_PUBLIC_SITE_URL || 'https://blabber.ai'}/onyx-callback`,
    customer_ip: params.customer_ip || '',
    // Passthru for webhook/callback - Onyx may echo these
    metadata: params.metadata,
  };

  if (params.payment_method_id) {
    body.payment_method_id = params.payment_method_id;
    delete body.card_number;
    delete body.expiry_month;
    delete body.expiry_year;
    delete body.cvv;
  }

  if (params.save_card) {
    body.save_card = true;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ONYX_API_KEY,
      'x-merchant-id': ONYX_MERCHANT_ID,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      success: false,
      status: 'FAILED',
      message: data.message || data.error || `HTTP ${res.status}`,
    };
  }

  const status = (data.status || '').toUpperCase();
  const paymentMethodId = data.payment_method_id ?? data.token ?? data.customer_payment_method_id;
  if (status === 'SUCCESS') {
    return {
      success: true,
      status: 'SUCCESS',
      transaction_id: data.transaction_id,
      payment_method_id: paymentMethodId,
    };
  }
  if (status === 'REDIRECT' && data.redirect_url) {
    return {
      success: true,
      status: 'REDIRECT',
      transaction_id: data.transaction_id,
      redirect_url: data.redirect_url,
      payment_method_id: paymentMethodId,
    };
  }

  return {
    success: false,
    status: 'FAILED',
    transaction_id: data.transaction_id,
    message: data.message || data.error || 'Payment failed',
  };
}

/**
 * Check payment status (e.g. after 3DS redirect).
 */
export async function checkOnyxPaymentStatus(transactionId: string): Promise<OnyxStatusResult> {
  if (!ONYX_API_KEY || !ONYX_MERCHANT_ID) {
    throw new Error('ONYX_API_KEY and ONYX_MERCHANT_ID must be set');
  }

  const url = getStatusEndpoint(transactionId);
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ONYX_API_KEY,
      'x-merchant-id': ONYX_MERCHANT_ID,
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      success: false,
      status: 'FAILED',
      message: data.message || data.error || `HTTP ${res.status}`,
    };
  }

  const status = (data.status || '').toUpperCase();
  if (status === 'SUCCESS') {
    return { success: true, status: 'SUCCESS', transaction_id: data.transaction_id || transactionId };
  }
  if (status === 'PENDING') {
    return { success: false, status: 'PENDING', transaction_id: data.transaction_id || transactionId, message: data.message };
  }

  return {
    success: false,
    status: 'FAILED',
    transaction_id: data.transaction_id || transactionId,
    message: data.message || data.error || 'Unknown status',
  };
}
