'use client';

import {
  createContext,
  useContext,
  type ReactNode,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import {
  normalizeFiatPaymentProcessor,
  type FiatPaymentProcessor,
} from '@/lib/payments/fiat-processor';
import { parseMonetizationSettings } from '@/lib/schemas/platform-settings';
import { queryKeys } from '@/lib/query/keys';

export type CreditMonetizationContextValue = {
  creditOnlyEcosystem: boolean;
  pricePerCreditCents: number;
  fiatPaymentProcessor: FiatPaymentProcessor;
  loaded: boolean;
};

const DEFAULTS: CreditMonetizationContextValue = {
  creditOnlyEcosystem: false,
  pricePerCreditCents: 5,
  fiatPaymentProcessor: normalizeFiatPaymentProcessor(undefined),
  loaded: false,
};

const CreditMonetizationContext = createContext<CreditMonetizationContextValue>(DEFAULTS);

async function fetchMonetizationSettings(): Promise<CreditMonetizationContextValue> {
  const supabase = createClient();
  const { data } = await supabase
    .from('platform_settings')
    .select('key, value')
    .in('key', [
      'credit_only_ecosystem',
      'price_per_credit',
      'fiat_payment_processor',
      'active_payment_provider',
    ]);

  const settings = parseMonetizationSettings(data ?? []);
  return { ...settings, loaded: true };
}

export function CreditMonetizationProvider({ children }: { children: ReactNode }) {
  const { data } = useQuery({
    queryKey: queryKeys.platformSettings.monetization(),
    queryFn: fetchMonetizationSettings,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <CreditMonetizationContext.Provider value={data ?? DEFAULTS}>
      {children}
    </CreditMonetizationContext.Provider>
  );
}

export function useCreditMonetization() {
  return useContext(CreditMonetizationContext);
}
