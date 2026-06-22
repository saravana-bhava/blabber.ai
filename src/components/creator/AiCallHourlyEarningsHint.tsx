'use client';

import {
  estimateAiCallCreatorHourlyDollars,
  formatAiCallBillingIntervalLabel,
} from '@/lib/ai-call-hourly-earnings';
import { useAiCallBillingSettings } from '@/lib/hooks/use-ai-call-billing-settings';

type AiCallHourlyEarningsHintProps = {
  aiCallMulti: number | null | undefined;
  /** Agency % of creator share (override or agency default), if managed by an agency. */
  agencySplitPct?: number | null;
};

export function AiCallHourlyEarningsHint({
  aiCallMulti,
  agencySplitPct,
}: AiCallHourlyEarningsHintProps) {
  const { settings, ready } = useAiCallBillingSettings();

  if (!aiCallMulti || aiCallMulti < 1) return null;

  if (!ready || !settings) {
    return <span className="text-muted-foreground"> — earnings estimate unavailable</span>;
  }

  const hourly = estimateAiCallCreatorHourlyDollars(
    aiCallMulti,
    settings,
    agencySplitPct
  );

  if (hourly == null) {
    return <span className="text-muted-foreground"> — earnings estimate unavailable</span>;
  }

  const intervalLabel = formatAiCallBillingIntervalLabel(settings.callCreditIntervalSeconds);

  return (
    <span className="text-muted-foreground">
      {` — ≈ $${hourly.toFixed(2)}/hr creator earnings (${intervalLabel}, before taxes)`}
    </span>
  );
}
