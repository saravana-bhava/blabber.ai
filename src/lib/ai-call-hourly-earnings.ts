/** Matches CallModal when platform_settings row is missing. */
export const DEFAULT_CALL_CREDIT_INTERVAL_SECONDS = 4;
export const DEFAULT_PLATFORM_SPLIT_AI_PCT = 30;

export type AiCallBillingSettings = {
  callCreditIntervalSeconds: number;
  pricePerCreditCents: number;
  platformSplitPct: number;
};

/**
 * Creator take-home per hour of continuous AI call billing (platform + optional agency split).
 * Billing: every `callCreditIntervalSeconds`, deduct `aiCallMulti` credits at `pricePerCreditCents` each.
 */
export function estimateAiCallCreatorHourlyDollars(
  aiCallMulti: number,
  settings: AiCallBillingSettings,
  agencySplitPct?: number | null
): number | null {
  if (!Number.isFinite(aiCallMulti) || aiCallMulti < 1) return null;

  const { callCreditIntervalSeconds, pricePerCreditCents, platformSplitPct } = settings;
  if (callCreditIntervalSeconds <= 0 || pricePerCreditCents <= 0) return null;

  const intervalsPerHour = 3600 / callCreditIntervalSeconds;
  const creditsPerHour = intervalsPerHour * aiCallMulti;
  const grossCentsPerHour = creditsPerHour * pricePerCreditCents;
  const platformShareCents = Math.floor(grossCentsPerHour * (platformSplitPct / 100));
  let creatorShareCents = grossCentsPerHour - platformShareCents;

  if (agencySplitPct != null && agencySplitPct > 0) {
    const agencyShareCents = Math.min(
      Math.floor(creatorShareCents * (agencySplitPct / 100)),
      creatorShareCents
    );
    creatorShareCents -= agencyShareCents;
  }

  return creatorShareCents / 100;
}

export function formatAiCallBillingIntervalLabel(intervalSeconds: number): string {
  if (intervalSeconds <= 0) return 'each billing interval';
  return `every ${intervalSeconds}s`;
}
