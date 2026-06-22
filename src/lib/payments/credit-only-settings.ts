import { createServiceRoleClient } from '@/lib/supabase/server';

export type CreditOnlyMonetizationSettings = {
  creditOnlyEcosystem: boolean;
  pricePerCreditCents: number;
};

export async function getCreditOnlyMonetizationSettings(): Promise<CreditOnlyMonetizationSettings> {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from('platform_settings')
    .select('key, value')
    .in('key', ['credit_only_ecosystem', 'price_per_credit']);

  const map = new Map<string, string>();
  for (const row of data || []) {
    if (row.key && row.value != null) map.set(row.key, String(row.value));
  }

  const raw = map.get('credit_only_ecosystem')?.trim().toLowerCase();
  const creditOnlyEcosystem = raw === 'true' || raw === '1' || raw === 'yes';

  const ppc = parseInt(map.get('price_per_credit') || '5', 10);
  const pricePerCreditCents = Number.isFinite(ppc) && ppc > 0 ? ppc : 5;

  return { creditOnlyEcosystem, pricePerCreditCents };
}

export function usdCentsToCreditsRequired(amountCents: number, pricePerCreditCents: number): number {
  if (!Number.isFinite(amountCents) || amountCents <= 0) return 0;
  const ppc = Number.isFinite(pricePerCreditCents) && pricePerCreditCents > 0 ? pricePerCreditCents : 5;
  return Math.max(1, Math.ceil(amountCents / ppc));
}
