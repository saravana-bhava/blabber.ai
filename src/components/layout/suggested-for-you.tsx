'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RemoteImage } from '@/components/ui/remote-image';
import { RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface SuggestionProfile {
  id: string;
  full_name: string;
  username: string;
  bio?: string;
  avatar_url?: string;
  banner_url?: string;
  engagement_score: number;
  post_count: number;
  total_likes: number;
  total_comments: number;
  total_bookmarks: number;
}

function SuggestCard({ profile, priority = false }: { profile: SuggestionProfile; priority?: boolean }) {
  return (
    <div className="flex cursor-pointer items-center gap-[11px] rounded-[14px] px-2.5 py-2.5 transition-colors duration-150 hover:bg-secondary">
      <Link href={`/u/${profile.username}`} className="flex min-w-0 flex-1 items-center gap-[11px]">
        <div
          className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full p-[2px]"
          style={{ background: 'var(--brand-grad)' }}
        >
          <div className="relative h-full w-full overflow-hidden rounded-full border-2 border-background bg-muted">
            {profile.avatar_url ? (
              <RemoteImage
                src={profile.avatar_url}
                alt={profile.full_name || profile.username}
                width={40}
                height={40}
                className="h-full w-full object-cover"
                priority={priority}
              />
            ) : (
              <span className="grid h-full w-full place-items-center text-sm font-bold text-muted-foreground">
                {(profile.full_name || profile.username || 'U').charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold leading-tight text-foreground">
            {profile.full_name || profile.username}
          </p>
          <p className="mt-0.5 truncate text-xs leading-tight text-muted-foreground">
            @{profile.username}
          </p>
        </div>
      </Link>
      <Link
        href={`/u/${profile.username}`}
        className="inline-flex h-8 shrink-0 items-center rounded-full border border-border px-3.5 text-[12.5px] font-semibold text-foreground transition-colors hover:border-[var(--brand-pink)] hover:text-[var(--brand-pink)]"
      >
        Subscribe
      </Link>
    </div>
  );
}

function SuggestCardSkeleton() {
  return (
    <div className="flex items-center gap-[11px] px-0.5 py-[7px]">
      <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-muted ring-2 ring-border" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-7 w-20 shrink-0 animate-pulse rounded-full bg-muted" />
    </div>
  );
}

export function SuggestedForYou() {
  const [suggestions, setSuggestions] = useState<SuggestionProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const supabase = createClient();

  const fetchSuggestions = async (page: number = 0) => {
    try {
      setIsFetching(true);

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
        p_limit: 5,
        p_offset: page * 5,
      });

      if (!error && data) {
        let filtered: SuggestionProfile[] = data;
        if (user?.id && blockedIds.length > 0) {
          filtered = filtered.filter((p) => !blockedIds.includes(p.id));
        }
        setSuggestions(filtered);
        setHasMore(filtered.length === 5);
      }
    } catch {
      // silent fail — suggestions are non-critical
    } finally {
      setIsFetching(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => fetchSuggestions(0), 100);
    return () => clearTimeout(t);
  }, []);

  const handleRefresh = () => {
    if (isFetching) return;
    const next = hasMore ? currentPage + 1 : 0;
    setCurrentPage(next);
    fetchSuggestions(next);
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between px-2 pb-1.5">
        <span
          className="text-[13px] font-bold uppercase tracking-[0.04em]"
          style={{ color: 'var(--muted-foreground)' }}
        >
          Suggested for you
        </span>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isFetching}
          title={hasMore ? 'Next page' : 'Refresh'}
          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-40"
        >
          <RefreshCw size={14} className={cn(isFetching && 'animate-spin')} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <SuggestCardSkeleton key={i} />)
          : suggestions.length > 0
            ? suggestions.map((s, i) => (
                <SuggestCard key={s.id} profile={s} priority={i === 0} />
              ))
            : (
              <p className="px-2.5 py-8 text-center text-sm text-muted-foreground">
                No suggestions right now
              </p>
            )}
      </div>
    </section>
  );
}

export function SuggestedForYouSkeleton() {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between px-2 pb-1.5">
        <div className="h-3 w-32 animate-pulse rounded bg-muted" />
        <div className="h-7 w-7 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain">
        {Array.from({ length: 5 }).map((_, i) => (
          <SuggestCardSkeleton key={i} />
        ))}
      </div>
    </section>
  );
}
