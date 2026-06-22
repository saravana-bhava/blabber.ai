'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useCreditMonetization } from '@/lib/contexts/credit-monetization-context';
import {
  type AiCallBillingSettings,
  DEFAULT_CALL_CREDIT_INTERVAL_SECONDS,
  DEFAULT_PLATFORM_SPLIT_AI_PCT,
} from '@/lib/ai-call-hourly-earnings';
import { parseAiCallBillingSettings } from '@/lib/schemas/platform-settings';
import { queryKeys } from '@/lib/query/keys';

async function fetchAiCallBillingRaw() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('platform_settings')
    .select('key, value')
    .in('key', ['call_credit_interval', 'platform_split_ai']);

  if (error) throw error;

  return parseAiCallBillingSettings(data ?? [], {
    intervalSeconds: DEFAULT_CALL_CREDIT_INTERVAL_SECONDS,
    platformSplitPct: DEFAULT_PLATFORM_SPLIT_AI_PCT,
  });
}

export function useAiCallBillingSettings() {
  const { pricePerCreditCents, loaded: monetizationLoaded } = useCreditMonetization();

  const {
    data: raw,
    isError: platformFetchError,
  } = useQuery({
    queryKey: queryKeys.platformSettings.aiCallBilling(),
    queryFn: fetchAiCallBillingRaw,
    staleTime: 5 * 60 * 1000,
  });

  const ready = monetizationLoaded && raw != null;

  const settings: AiCallBillingSettings | null = useMemo(() => {
    if (!ready || !raw) return null;
    return {
      callCreditIntervalSeconds: raw.intervalSeconds,
      pricePerCreditCents,
      platformSplitPct: raw.platformSplitPct,
    };
  }, [ready, raw, pricePerCreditCents]);

  return { settings, ready, platformFetchError };
}
