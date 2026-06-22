'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Video } from 'lucide-react';
import { RemoteImage } from '@/components/ui/remote-image';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/contexts/user-context';
import { GoLiveModal } from '@/components/live/GoLiveModal';
import { cn } from '@/lib/utils';

type LiveNowEntry = {
  postId: string;
  userId: string;
  viewCount: number;
  profile: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
};

function formatWatchingCount(n: number): string {
  const count = Math.max(n, 1);
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return String(count);
}

function LiveNowSkeleton() {
  return (
    <div className="rounded-[14px] border border-border bg-card p-[15px]">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
        <div className="h-3 w-16 animate-pulse rounded bg-muted" />
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
            <div className="h-3 w-16 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-8 w-14 animate-pulse rounded-full bg-muted" />
        </div>
      ))}
    </div>
  );
}

function LiveAvatar({
  profile,
  priority = false,
}: {
  profile: LiveNowEntry['profile'];
  priority?: boolean;
}) {
  const initial = (profile.full_name || profile.username || 'U').charAt(0).toUpperCase();

  return (
    <div
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full p-[2px]"
      style={{ background: 'var(--brand-live)' }}
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
            {initial}
          </span>
        )}
      </div>
    </div>
  );
}

export function LiveNowRail() {
  const { session } = useUser();
  const [liveEntries, setLiveEntries] = useState<LiveNowEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [goLiveOpen, setGoLiveOpen] = useState(false);
  const supabase = createClient();

  const fetchLiveNow = useCallback(async () => {
    try {
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

      const { data, error } = await supabase
        .from('posts')
        .select(
          `
          id,
          user_id,
          view_count,
          created_at,
          profiles (id, username, full_name, avatar_url),
          post_media!inner (metadata, media_type)
        `
        )
        .eq('content_type', 'live_stream')
        .order('created_at', { ascending: false })
        .limit(30);

      if (error || !data) {
        setLiveEntries([]);
        return;
      }

      const seen = new Set<string>();
      const entries: LiveNowEntry[] = [];

      for (const row of data) {
        const media = (row as { post_media?: { metadata?: { status?: string }; media_type?: string }[] })
          .post_media?.[0];
        if (media?.metadata?.status !== 'live') continue;

        const userId = row.user_id as string;
        if (blockedIds.includes(userId) || seen.has(userId)) continue;
        seen.add(userId);

        const rawProfiles = row.profiles as
          | LiveNowEntry['profile']
          | LiveNowEntry['profile'][]
          | null;
        const prof = Array.isArray(rawProfiles) ? rawProfiles[0] : rawProfiles;
        if (!prof?.username) continue;

        entries.push({
          postId: row.id as string,
          userId,
          viewCount: (row.view_count as number) ?? 0,
          profile: prof,
        });
      }

      entries.sort((a, b) => b.viewCount - a.viewCount);
      setLiveEntries(entries.slice(0, 5));
    } catch {
      setLiveEntries([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    const t = setTimeout(() => void fetchLiveNow(), 100);
    return () => clearTimeout(t);
  }, [fetchLiveNow]);

  useEffect(() => {
    const channel = supabase
      .channel('rail-live-streams')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'post_media' },
        () => {
          void fetchLiveNow();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchLiveNow]);

  if (loading) {
    return <LiveNowSkeleton />;
  }

  const creatorLabel =
    liveEntries.length === 1 ? '1 creator' : `${liveEntries.length} creators`;

  return (
    <>
      <div className="shrink-0 rounded-[14px] border border-border bg-card p-[15px]">
        <div className="mb-3 flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.03em] text-white"
            style={{ background: 'var(--brand-live)' }}
          >
            <span className="live-dot-anim" aria-hidden />
            Live now
          </span>
          <span className="text-[12.5px] font-semibold text-muted-foreground">{creatorLabel}</span>
          <div className="min-w-0 flex-1" />
          {session && (
            <button
              type="button"
              onClick={() => setGoLiveOpen(true)}
              className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold text-[var(--brand-on-accent)] transition-[filter] hover:brightness-110"
              style={{
                background: 'var(--brand-grad)',
                boxShadow: 'var(--brand-ring-money)',
              }}
            >
              <Video className="h-3 w-3" aria-hidden />
              Go live
            </button>
          )}
        </div>

        {liveEntries.length === 0 ? (
          <p className="py-2 text-center text-[12.5px] leading-relaxed text-muted-foreground">
            No creators are live right now.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {liveEntries.map((entry, index) => (
              <li key={entry.postId}>
                <div className="flex items-center gap-[11px] rounded-[10px] px-0.5 py-[7px] transition-colors hover:bg-muted/40">
                  <Link href={`/u/${entry.profile.username}`} className="shrink-0">
                    <LiveAvatar profile={entry.profile} priority={index === 0} />
                  </Link>
                  <Link href={`/u/${entry.profile.username}`} className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold leading-tight text-foreground">
                      {entry.profile.full_name || entry.profile.username}
                    </p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {formatWatchingCount(entry.viewCount)} watching
                    </p>
                  </Link>
                  <Link
                    href={`/p/${entry.postId}`}
                    className={cn(
                      'inline-flex h-[30px] shrink-0 items-center rounded-full border border-border px-3 text-[12.5px] font-semibold text-foreground',
                      'transition-colors hover:border-[var(--brand-pink)]/40 hover:bg-muted/50 hover:text-[var(--brand-pink)]'
                    )}
                  >
                    Join
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <GoLiveModal isOpen={goLiveOpen} onClose={() => setGoLiveOpen(false)} />
    </>
  );
}
