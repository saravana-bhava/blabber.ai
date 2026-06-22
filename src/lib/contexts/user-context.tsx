'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AffiliateProfileRow, AgencyRow, CreatorRow, Profile } from '@/lib/types';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { isEmailConfirmed } from '@/lib/auth/email-confirmed';
import * as Sentry from '@sentry/nextjs';

function isAuthSessionError(error: { status?: number; message?: string }): boolean {
  if (error.status === 401 || error.status === 403) return true;
  const msg = (error.message ?? '').toLowerCase();
  return msg.includes('jwt') || msg.includes('invalid') || msg.includes('expired');
}

interface UserContextType {
  session: Session | null;
  profile: Profile | null;
  setProfile: (profile: Profile | null) => void;
  hasUnreadMessages: boolean;
  setHasUnreadMessages: (hasUnread: boolean) => void;
  isLoading: boolean;
  /** Re-fetch the current user's profile from Supabase (e.g. after credit purchase). */
  refreshProfile: () => Promise<void>;
  /** Creator row for the current session, if the profile has one. */
  creator: CreatorRow | null;
  /** Agency row for the current session, if the profile has one. */
  agency: AgencyRow | null;
  /** Affiliate profile row for the current session, if the profile has one. */
  affiliateProfile: AffiliateProfileRow | null;
  /** Convenience flag: true when the user has a creator row. */
  isCreator: boolean;
  /** Convenience flag: true when the user has an agency row. */
  isAgency: boolean;
  /** Convenience flag: true when the user has an affiliate_profiles row. */
  isAffiliate: boolean;
  /** Re-fetch creator + agency + affiliate rows. */
  refreshAccountRoles: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  session: null,
  profile: null,
  setProfile: () => {},
  hasUnreadMessages: false,
  setHasUnreadMessages: () => {},
  isLoading: true,
  refreshProfile: async () => {},
  creator: null,
  agency: null,
  affiliateProfile: null,
  isCreator: false,
  isAgency: false,
  isAffiliate: false,
  refreshAccountRoles: async () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [creator, setCreator] = useState<CreatorRow | null>(null);
  const [agency, setAgency] = useState<AgencyRow | null>(null);
  const [affiliateProfile, setAffiliateProfile] = useState<AffiliateProfileRow | null>(null);

  /** Tracks signed-in user id for auth callbacks (avoid stale closure in applySession). */
  const sessionUserIdRef = useRef<string | null>(null);
  const refreshProfileRef = useRef<() => Promise<void>>(async () => {});
  const refreshAccountRolesRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    sessionUserIdRef.current = session?.user?.id ?? null;
  }, [session?.user?.id]);

  useEffect(() => {
    const supabase = createClient();

    const applySession = async (next: Session | null) => {
      if (!next) {
        Sentry.setUser(null);
        sessionUserIdRef.current = null;
        setSession(null);
        setProfile(null);
        setCreator(null);
        setAgency(null);
        setAffiliateProfile(null);
        setIsLoading(false);
        return;
      }

      const nextUserId = next.user.id;
      const sameUser = nextUserId === sessionUserIdRef.current;

      // Use getUser() so email_confirmed_at is fresh after confirm redirect (avoids false sign-out).
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        // Only sign out on real auth failures — not transient local/network errors.
        if (isAuthSessionError(error)) {
          await supabase.auth.signOut();
          Sentry.setUser(null);
          sessionUserIdRef.current = null;
          setSession(null);
          setProfile(null);
          setCreator(null);
          setAgency(null);
        }
        setIsLoading(false);
        return;
      }

      if (user && !isEmailConfirmed(user)) {
        await supabase.auth.signOut();
        Sentry.setUser(null);
        sessionUserIdRef.current = null;
        setSession(null);
        setProfile(null);
        setCreator(null);
        setAgency(null);
        setAffiliateProfile(null);
        setIsLoading(false);
        return;
      }

      sessionUserIdRef.current = nextUserId;
      setSession(next);

      if (sameUser) {
        // Token refresh / tab focus / USER_UPDATED: keep UI as-is; refresh data in background.
        void refreshProfileRef.current();
        void refreshAccountRolesRef.current();
        return;
      }

      // New sign-in: profile effect will load profile + roles and clear loading.
      setIsLoading(true);
    };

    void supabase.auth.getSession().then(({ data: { session } }) => {
      void applySession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // INITIAL_SESSION: already handled by getSession() above — skip to avoid the
      // macrotask-after-profile-load race that resets isLoading → true permanently.
      if (event === 'INITIAL_SESSION') return;

      // TOKEN_REFRESHED: handled in applySession via sameUser (no skeleton flash).
      if (event === 'TOKEN_REFRESHED') {
        if (session) {
          sessionUserIdRef.current = session.user.id;
          setSession(session);
        }
        return;
      }

      // All other events (SIGNED_IN, SIGNED_OUT, USER_UPDATED, …): defer to avoid
      // a getUser() deadlock inside the auth state-change callback.
      window.setTimeout(() => void applySession(session), 0);
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user?.id) return;
    const supabase = createClient();

    const loadProfile = async () =>
      supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();

    let { data, error } = await loadProfile();

    // No row yet (common on new staging DB) — bootstrap then retry once
    if (!data && (!error || error.code === 'PGRST116')) {
      try {
        await fetch('/api/auth/bootstrap-session', {
          method: 'POST',
          credentials: 'include',
        });
      } catch {
        // bootstrap failed — fall through; loadProfile will return null and we bail below
      }
      ({ data, error } = await loadProfile());
    }

    if (error || !data) return;
    if (data.isBanned) {
      await supabase.auth.signOut();
      Sentry.setUser(null);
      setProfile(null);
      setSession(null);
      return;
    }
    setProfile(data);
    Sentry.setUser({
      id: data.id,
      username: data.username ?? undefined,
    });
    setHasUnreadMessages(!!data.hasUnreadMsg);
  }, [session?.user?.id]);

  const refreshAccountRoles = useCallback(async () => {
    if (!session?.user?.id) {
      setCreator(null);
      setAgency(null);
      setAffiliateProfile(null);
      return;
    }
    const supabase = createClient();
    const [{ data: creatorRow }, { data: agencyRow }, { data: affiliateRow }] = await Promise.all([
      supabase
        .from('creators')
        .select(
          'profile_id, agency_profile_id, agency_split_pct_override, is_agency_operated, veriff_verification_status, can_monetize, can_img_gen, ai_call_enabled, ai_dms_enabled, subscription_price_cents, subscription_interval, subscription_tier_enabled'
        )
        .eq('profile_id', session.user.id)
        .maybeSingle(),
      supabase
        .from('agencies')
        .select('*')
        .eq('profile_id', session.user.id)
        .maybeSingle(),
      supabase
        .from('affiliate_profiles')
        .select('*')
        .eq('profile_id', session.user.id)
        .maybeSingle(),
    ]);
    setCreator((creatorRow as CreatorRow | null) ?? null);
    setAgency((agencyRow as AgencyRow | null) ?? null);
    setAffiliateProfile((affiliateRow as AffiliateProfileRow | null) ?? null);
  }, [session?.user?.id]);

  useEffect(() => {
    refreshProfileRef.current = refreshProfile;
    refreshAccountRolesRef.current = refreshAccountRoles;
  }, [refreshProfile, refreshAccountRoles]);


  useEffect(() => {
    if (!session?.user?.id) {
      Sentry.setUser(null);
      setProfile(null);
      setCreator(null);
      setAgency(null);
      setAffiliateProfile(null);
      return;
    }

    let cancelled = false;
    const profileMatchesSession = profile?.id === session.user.id;
    if (!profileMatchesSession) {
      setIsLoading(true);
    }

    void (async () => {
      try {
        await refreshProfile();
        await refreshAccountRoles();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, refreshProfile, refreshAccountRoles]);

  return (
    <UserContext.Provider
      value={{
        session,
        profile,
        setProfile,
        hasUnreadMessages,
        setHasUnreadMessages,
        isLoading,
        refreshProfile,
        creator,
        agency,
        affiliateProfile,
        isCreator: !!creator,
        isAgency: !!agency,
        isAffiliate: !!affiliateProfile,
        refreshAccountRoles,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
