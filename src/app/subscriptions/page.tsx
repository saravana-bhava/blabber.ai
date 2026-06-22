'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Compass, Star } from 'lucide-react';

import { PageShell } from '@/components/layout/page-header';
import { useUser } from '@/lib/contexts/user-context';
import { RequireAuth } from '@/components/auth/require-auth';
import { AdminGradButton, AdminPill } from '@/components/admin/admin-ui';
import { AIBadge } from '@/components/landing/_atoms';

interface SubscribedProfile {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  current_period_ends_at: string | null;
  price_at_time_of_subscription_cents: number | null;
  interval_at_time_of_subscription: 'month' | 'year' | null;
  ai_enabled: boolean;
}

function formatRenewalDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatSubscriptionPrice(cents: number | null, interval: 'month' | 'year' | null): string | null {
  if (cents == null) return null;
  const dollars = (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
  const suffix = interval === 'year' ? '/yr' : '/mo';
  return `$${dollars}${suffix}`;
}

function SubscriptionCardSkeleton() {
  return (
    <div className="admin-card overflow-hidden">
      <div className="h-[84px] animate-pulse bg-secondary" />
      <div className="px-4 pb-4 -mt-[26px]">
        <div className="mb-2 h-[52px] w-[52px] animate-pulse rounded-full bg-muted ring-[3px] ring-card" />
        <div className="mb-1.5 h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="mb-3 h-3.5 w-24 animate-pulse rounded bg-muted" />
        <div className="flex items-center justify-between">
          <div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
          <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
        </div>
      </div>
    </div>
  );
}

function SubscriptionCard({ profile }: { profile: SubscribedProfile }) {
  const displayName = profile.full_name || profile.username || 'Creator';
  const initial = displayName.charAt(0).toUpperCase();
  const renewal = formatRenewalDate(profile.current_period_ends_at);
  const price = formatSubscriptionPrice(
    profile.price_at_time_of_subscription_cents,
    profile.interval_at_time_of_subscription,
  );

  return (
    <Link
      href={`/u/${profile.username}`}
      className="group block text-left transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-pink)] focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-[18px]"
    >
      <article className="admin-card overflow-hidden">
        <div
          className="h-[84px] bg-cover bg-center"
          style={
            profile.banner_url
              ? { backgroundImage: `url(${profile.banner_url})` }
              : { background: 'var(--brand-grad)' }
          }
        />
        <div className="px-4 pb-4 -mt-[26px]">
          <div className="mb-2 w-fit rounded-full ring-[3px] ring-card">
            <div
              className="relative grid h-[52px] w-[52px] place-items-center rounded-full p-[2px]"
              style={{ background: 'var(--brand-grad)' }}
            >
              <div className="relative h-full w-full overflow-hidden rounded-full border-2 border-card bg-muted">
                {profile.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt={displayName}
                    width={52}
                    height={52}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="grid h-full w-full place-items-center text-base font-bold text-muted-foreground">
                    {initial}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate text-[15px] font-bold text-foreground">{displayName}</p>
            {profile.ai_enabled ? <AIBadge small /> : null}
          </div>
          {profile.username ? (
            <p className="mt-0.5 truncate text-[13px] text-muted-foreground">@{profile.username}</p>
          ) : null}

          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-[12.5px] text-muted-foreground">
              {renewal ? `Renews ${renewal}` : 'Active subscription'}
            </span>
            {price ? (
              <AdminPill variant="soft" className="text-[12px]">
                {price}
              </AdminPill>
            ) : null}
          </div>
        </div>
      </article>
    </Link>
  );
}

function SubscriptionsEmptyState() {
  return (
    <div className="flex min-h-[52vh] items-center justify-center px-6 py-12 text-center">
      <div className="max-w-[360px]">
        <div className="mx-auto mb-4 grid h-[60px] w-[60px] place-items-center rounded-[18px] bg-secondary text-muted-foreground">
          <Star className="h-[26px] w-[26px]" aria-hidden />
        </div>
        <h2 className="font-display text-xl tracking-tight">No subscriptions yet</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Subscribe to creators to unlock exclusive posts, messages, and more. Your active subscriptions will show up here.
        </p>
        <AdminGradButton asChild className="mt-6">
          <Link href="/explore">
            <Compass className="mr-1.5 h-4 w-4" aria-hidden />
            Discover creators
          </Link>
        </AdminGradButton>
      </div>
    </div>
  );
}

export default function SubscriptionsPage() {
  const supabase = createClient();
  const { session, isLoading } = useUser();
  const [subscribedProfiles, setSubscribedProfiles] = useState<SubscribedProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubscribedProfiles = async () => {
      if (!session?.user) return;

      try {
        const { data: subscriptions, error: subError } = await supabase
          .from('subscriptions')
          .select(
            'following_id, current_period_ends_at, price_at_time_of_subscription_cents, interval_at_time_of_subscription',
          )
          .eq('follower_id', session.user.id)
          .eq('status', 'active');

        if (subError) throw subError;

        if (subscriptions && subscriptions.length > 0) {
          const followingIds = subscriptions.map((sub) => sub.following_id);

          const [{ data: profiles, error: profError }, { data: creators }] = await Promise.all([
            supabase
              .from('profiles')
              .select('id, full_name, username, avatar_url, banner_url')
              .in('id', followingIds),
            supabase
              .from('creators')
              .select('profile_id, ai_dms_enabled, ai_call_enabled')
              .in('profile_id', followingIds),
          ]);

          if (profError) throw profError;

          const subByCreator = new Map(subscriptions.map((sub) => [sub.following_id, sub]));
          const aiByProfile = new Map(
            (creators ?? []).map((creator) => [
              creator.profile_id,
              Boolean(creator.ai_dms_enabled || creator.ai_call_enabled),
            ]),
          );

          const merged: SubscribedProfile[] = (profiles ?? []).map((profile) => {
            const sub = subByCreator.get(profile.id);
            return {
              ...profile,
              current_period_ends_at: sub?.current_period_ends_at ?? null,
              price_at_time_of_subscription_cents: sub?.price_at_time_of_subscription_cents ?? null,
              interval_at_time_of_subscription: sub?.interval_at_time_of_subscription ?? null,
              ai_enabled: aiByProfile.get(profile.id) ?? false,
            };
          });

          setSubscribedProfiles(merged);
        } else {
          setSubscribedProfiles([]);
        }
      } catch (error) {
        console.error('Error fetching subscribed profiles:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscribedProfiles();
  }, [session?.user, supabase]);

  const subtitle = useMemo(() => {
    if (isLoading || loading) return undefined;
    const count = subscribedProfiles.length;
    return count === 1 ? '1 active creator' : `${count} active creators`;
  }, [isLoading, loading, subscribedProfiles.length]);

  const showSpinner = isLoading || loading;

  return (
    <RequireAuth>
      <PageShell title="Subscriptions" subtitle={subtitle}>
        <div className="mx-auto max-w-[720px] px-[22px] pb-16 pt-5">
          {showSpinner ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <SubscriptionCardSkeleton key={index} />
              ))}
            </div>
          ) : subscribedProfiles.length === 0 ? (
            <SubscriptionsEmptyState />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {subscribedProfiles.map((profile) => (
                <SubscriptionCard key={profile.id} profile={profile} />
              ))}
            </div>
          )}
        </div>
      </PageShell>
    </RequireAuth>
  );
}
