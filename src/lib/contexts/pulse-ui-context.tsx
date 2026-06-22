'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/contexts/user-context';
import {
  getDefaultPulseMode,
  getStoredPulseMode,
  setStoredPulseMode,
  type PulseUIMode,
} from '@/lib/pulse-ui-storage';
import { queryKeys } from '@/lib/query/keys';

const EARNING_LIVE_MS = 10_000;

type PulseUIContextValue = {
  mode: PulseUIMode;
  /** True when Pulse Engine visuals are active */
  pulseEnabled: boolean;
  setMode: (mode: PulseUIMode) => void;
  /** ~10s after a realtime earning event (tip, sub, call billing, PPV, product); works in Classic or Pulse */
  isEarningLive: boolean;
};

const PulseUIContext = createContext<PulseUIContextValue | null>(null);

export function PulseUIProvider({ children }: { children: React.ReactNode }) {
  const { profile, session } = useUser();
  const [mode, setModeState] = useState<PulseUIMode>(() => getDefaultPulseMode());
  const [earningLiveUntil, setEarningLiveUntil] = useState(0);

  useEffect(() => {
    const stored = getStoredPulseMode();
    if (stored) setModeState(stored);
    else setModeState(getDefaultPulseMode());
  }, []);

  useEffect(() => {
    document.documentElement.dataset.pulseUi = mode === 'pulse' ? 'true' : 'false';
  }, [mode]);

  const setMode = useCallback((next: PulseUIMode) => {
    setModeState(next);
    setStoredPulseMode(next);
  }, []);

  const { data: creatorData } = useQuery({
    queryKey: queryKeys.creatorRow(profile?.id ?? ''),
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('creators')
        .select('profile_id')
        .eq('profile_id', profile!.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!profile?.id,
    staleTime: 5 * 60 * 1000,
  });

  const hasCreatorRow = creatorData ?? false;

  const bumpEarningLive = useCallback(() => {
    setEarningLiveUntil(Date.now() + EARNING_LIVE_MS);
  }, []);

  // Creator: "Earning live" from tips, subs, calls (incl. billing ticks), PPV, product sales (requires tables in supabase_realtime)
  useEffect(() => {
    if (!session?.user?.id || !profile?.id) return;

    const supabase = createClient();
    const profileId = profile.id;
    const channel = supabase.channel(`pulse-earning-${profileId}`);

    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'tip_transactions',
        filter: `creator_id=eq.${profileId}`,
      },
      bumpEarningLive
    );

    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'subscription_payments',
        filter: `creator_profile_id=eq.${profileId}`,
      },
      bumpEarningLive
    );

    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'call_transactions',
        filter: `creator_profile_id=eq.${profileId}`,
      },
      bumpEarningLive
    );

    // Keep state alive while a fan’s AI call is billing (row updates on each credit interval)
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'call_transactions',
        filter: `creator_profile_id=eq.${profileId}`,
      },
      bumpEarningLive
    );

    if (hasCreatorRow) {
      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'creator_product_transactions' },
        async (payload) => {
          const row = payload.new as { creator_product_id?: string };
          if (!row?.creator_product_id) return;
          const { data } = await supabase
            .from('creator_products')
            .select('creator_profile_id')
            .eq('id', row.creator_product_id)
            .maybeSingle();
          if (data?.creator_profile_id === profileId) bumpEarningLive();
        }
      );

      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ppv_transactions' },
        async (payload) => {
          const row = payload.new as { post_id?: string };
          if (!row?.post_id) return;
          const { data } = await supabase
            .from('posts')
            .select('profile_id')
            .eq('id', row.post_id)
            .maybeSingle();
          if (data?.profile_id === profileId) bumpEarningLive();
        }
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, profile?.id, hasCreatorRow, bumpEarningLive]);

  useEffect(() => {
    if (earningLiveUntil <= Date.now()) return;
    const ms = Math.max(0, earningLiveUntil - Date.now());
    const t = window.setTimeout(() => setEarningLiveUntil(0), ms);
    return () => clearTimeout(t);
  }, [earningLiveUntil]);

  const isEarningLive = earningLiveUntil > Date.now();

  const value = useMemo(
    () => ({
      mode,
      pulseEnabled: mode === 'pulse',
      setMode,
      isEarningLive,
    }),
    [mode, setMode, isEarningLive]
  );

  return (
    <PulseUIContext.Provider value={value}>{children}</PulseUIContext.Provider>
  );
}

export function usePulseUI() {
  const ctx = useContext(PulseUIContext);
  if (!ctx) {
    throw new Error('usePulseUI must be used within PulseUIProvider');
  }
  return ctx;
}

/** Safe when provider is optional — returns pulse off. */
export function usePulseUIOptional() {
  return useContext(PulseUIContext);
}
