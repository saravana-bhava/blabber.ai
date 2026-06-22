'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

type TrendingProfile = {
  id: string;
  full_name: string;
  username: string;
  avatar_url?: string;
  engagement_score?: number;
  post_count?: number;
};

function formatFanLabel(score?: number, postCount?: number): string {
  const n = score ?? postCount ?? 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M fans`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k fans`;
  if (n > 0) return `${Math.round(n)} fans`;
  return 'Creator';
}

function TrendingCardSkeleton() {
  return (
    <div
      className="flex h-[196px] w-[168px] shrink-0 flex-col items-center rounded-[14px] border border-border bg-card p-3.5"
      aria-hidden
    >
      <div className="mb-2.5 h-[60px] w-[60px] animate-pulse rounded-full bg-muted" />
      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      <div className="mt-1 h-3 w-16 animate-pulse rounded bg-muted" />
      <div className="flex-1" />
      <div className="h-[34px] w-full animate-pulse rounded-full bg-muted" />
    </div>
  );
}

function TrendingCard({ profile }: { profile: TrendingProfile }) {
  const displayName = profile.full_name || profile.username;
  const initial = (displayName || 'U').charAt(0).toUpperCase();

  return (
    <div className="flex h-[196px] w-[168px] shrink-0 flex-col items-center rounded-[14px] border border-border bg-card p-3.5 text-center">
      <Link href={`/u/${profile.username}`} className="mb-2.5">
        <div
          className="relative grid h-[60px] w-[60px] place-items-center rounded-full p-[2px]"
          style={{ background: 'var(--brand-grad)' }}
        >
          <div className="relative h-full w-full overflow-hidden rounded-full border-2 border-background bg-muted">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={displayName}
                width={60}
                height={60}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="grid h-full w-full place-items-center text-lg font-bold text-muted-foreground">
                {initial}
              </span>
            )}
          </div>
        </div>
      </Link>
      <Link
        href={`/u/${profile.username}`}
        className="max-w-full truncate text-sm font-bold text-foreground hover:underline"
      >
        {displayName}
      </Link>
      <p className="mt-0.5 text-[12.5px] text-muted-foreground">
        {formatFanLabel(profile.engagement_score, profile.post_count)}
      </p>
      <div className="flex-1" />
      <Link
        href={`/u/${profile.username}`}
        className="inline-flex h-[34px] w-full items-center justify-center rounded-full text-[12.5px] font-semibold text-[var(--brand-on-accent)]"
        style={{ background: 'var(--brand-grad)', boxShadow: 'var(--brand-ring-money)' }}
      >
        Subscribe
      </Link>
    </div>
  );
}

export function ExploreTrendingCreators({ className }: { className?: string }) {
  const [profiles, setProfiles] = useState<TrendingProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        let blockedIds: string[] = [];
        if (user?.id) {
          const { data: blocked } = await supabase
            .from('blocked_users')
            .select('blockee_profile_id')
            .eq('blocker_profile_id', user.id);
          if (blocked) blockedIds = blocked.map((b: { blockee_profile_id: string }) => b.blockee_profile_id);
        }

        const { data, error } = await supabase.rpc('get_suggested_profiles', {
          p_current_user_id: user?.id || null,
          p_limit: 12,
          p_offset: 0,
        });

        if (!cancelled && !error && data) {
          let filtered: TrendingProfile[] = data;
          if (blockedIds.length > 0) {
            filtered = filtered.filter((p: TrendingProfile) => !blockedIds.includes(p.id));
          }
          setProfiles(filtered);
        }
      } catch {
        // non-critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className={cn('mb-7', className)}>
      <div className="mb-3 flex items-center gap-2">
        <Flame className="h-[18px] w-[18px] shrink-0 text-[var(--brand-pink)]" aria-hidden />
        <h2 className="font-display text-lg text-foreground">Trending creators</h2>
      </div>
      <div className="scroll-x -mx-[22px] flex gap-3 px-[22px] pb-1">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <TrendingCardSkeleton key={i} />)
          : profiles.length > 0
            ? profiles.map((p) => <TrendingCard key={p.id} profile={p} />)
            : (
              <p className="py-6 text-sm text-muted-foreground">No creators to show right now.</p>
            )}
      </div>
    </section>
  );
}
