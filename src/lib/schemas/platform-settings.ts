import { z } from 'zod';
import {
  normalizeFiatPaymentProcessor,
  type FiatPaymentProcessor,
} from '@/lib/payments/fiat-processor';

// Raw row shape returned by Supabase for platform_settings
export const platformSettingRowSchema = z.object({
  key: z.string(),
  value: z.unknown().transform((v) => String(v ?? '')),
});

export type PlatformSettingRow = z.infer<typeof platformSettingRowSchema>;

// Helper: parse a raw array of rows into a lookup map
function toMap(rows: Array<{ key: string; value: unknown }>): Map<string, string> {
  return new Map(
    rows.map((r) => [r.key, String(r.value ?? '')])
  );
}

// --- Monetization settings (credit_only_ecosystem, price_per_credit, fiat_payment_processor) ---

export const monetizationSettingsSchema = z.object({
  creditOnlyEcosystem: z.boolean(),
  pricePerCreditCents: z.number().int().positive(),
  fiatPaymentProcessor: z.custom<FiatPaymentProcessor>(),
});

export type MonetizationSettings = z.infer<typeof monetizationSettingsSchema>;

export function parseMonetizationSettings(
  rows: Array<{ key: string; value: unknown }>
): MonetizationSettings {
  const map = toMap(rows);

  const rawEco = map.get('credit_only_ecosystem')?.trim().toLowerCase();
  const creditOnlyEcosystem = rawEco === 'true' || rawEco === '1' || rawEco === 'yes';

  const ppc = parseInt(map.get('price_per_credit') || '5', 10);
  const pricePerCreditCents = Number.isFinite(ppc) && ppc > 0 ? ppc : 5;

  const fiatRaw = map.get('fiat_payment_processor')?.trim();
  const legacyRaw = map.get('active_payment_provider')?.trim();
  const fiatPaymentProcessor = normalizeFiatPaymentProcessor(fiatRaw || legacyRaw);

  return monetizationSettingsSchema.parse({ creditOnlyEcosystem, pricePerCreditCents, fiatPaymentProcessor });
}

// --- Image gen credit cost (image_gen_credit_cost) ---

export const imageGenCreditCostSchema = z.number().int().min(1).default(10);

export function parseImageGenCreditCost(
  rows: Array<{ key: string; value: unknown }>
): number {
  const map = toMap(rows);
  const raw = map.get('image_gen_credit_cost');
  const n = parseInt(raw ?? '10', 10);
  return imageGenCreditCostSchema.parse(Number.isFinite(n) && n >= 1 ? n : 10);
}

// --- AI call billing (call_credit_interval, platform_split_ai) ---

export const aiCallBillingSchema = z.object({
  intervalSeconds: z.number().int().positive(),
  platformSplitPct: z.number().int().min(0),
});

export type AiCallBillingRaw = z.infer<typeof aiCallBillingSchema>;

export function parseAiCallBillingSettings(
  rows: Array<{ key: string; value: unknown }>,
  defaults: { intervalSeconds: number; platformSplitPct: number }
): AiCallBillingRaw {
  const map = toMap(rows);

  const intervalRaw = parseInt(map.get('call_credit_interval') ?? '', 10);
  const intervalSeconds =
    Number.isFinite(intervalRaw) && intervalRaw > 0
      ? intervalRaw
      : defaults.intervalSeconds;

  const splitRaw = parseInt(map.get('platform_split_ai') ?? '', 10);
  const platformSplitPct =
    Number.isFinite(splitRaw) && splitRaw >= 0 ? splitRaw : defaults.platformSplitPct;

  return aiCallBillingSchema.parse({ intervalSeconds, platformSplitPct });
}
