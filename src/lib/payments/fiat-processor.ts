export type FiatPaymentProcessor = 'onyx' | 'stripe' | 'moonpay' | 'epoch' | 'goat' | 'uspaymate';

/**
 * Normalizes platform_settings value for card/fiat rails (wallet top-ups and non–credit-only purchases).
 */
export function normalizeFiatPaymentProcessor(raw: string | null | undefined): FiatPaymentProcessor {
  const v = (raw ?? 'onyx').trim().toLowerCase();
  if (v === 'stripe') return 'stripe';
  if (v === 'moonpay') return 'moonpay';
  if (v === 'epoch') return 'epoch';
  if (v === 'goat' || v === 'goatpayments' || v === 'goat_payments') return 'goat';
  if (v === 'uspaymate' || v === 'us_paymate' || v === 'us-paymate') return 'uspaymate';
  // Legacy admin value
  if (v === 'cc_pay' || v === 'ccpay') return 'onyx';
  return 'onyx';
}
