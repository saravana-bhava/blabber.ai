'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { searchUserProfiles } from '@/app/actions/postActions';

interface UserProfile {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
}

type ExploreUserResultsProps = {
  searchQuery: string;
};

function ResultRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-[14px] px-2 py-[11px]">
      <div className="h-[50px] w-[50px] shrink-0 animate-pulse rounded-full bg-muted" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-[34px] w-24 shrink-0 animate-pulse rounded-full bg-muted" />
    </div>
  );
}

function ResultRow({ profile }: { profile: UserProfile }) {
  const displayName = profile.full_name || profile.username || 'User';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-3 rounded-[14px] px-2 py-[11px] transition-colors hover:bg-muted/40">
      <Link href={`/u/${profile.username}`} className="shrink-0">
        <div
          className="relative grid h-[50px] w-[50px] place-items-center rounded-full p-[2px]"
          style={{ background: 'var(--brand-grad)' }}
        >
          <div className="relative h-full w-full overflow-hidden rounded-full border-2 border-background bg-muted">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={displayName}
                width={50}
                height={50}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="grid h-full w-full place-items-center text-sm font-bold text-muted-foreground">
                {initial}
              </span>
            )}
          </div>
        </div>
      </Link>
      <Link href={`/u/${profile.username}`} className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-foreground">{displayName}</p>
        <p className="truncate text-[13px] text-muted-foreground">
          @{profile.username}
          {profile.bio ? ` · ${profile.bio}` : ''}
        </p>
      </Link>
      <Link
        href={`/u/${profile.username}`}
        className="inline-flex h-[34px] shrink-0 items-center rounded-full border border-border px-3.5 text-[13px] font-semibold text-foreground transition-colors hover:border-[var(--brand-pink)] hover:text-[var(--brand-pink)]"
      >
        Subscribe
      </Link>
    </div>
  );
}

/** Dim ExploreTab search results list. */
export function ExploreUserResults({ searchQuery }: ExploreUserResultsProps) {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = searchQuery.trim();
  const canSearch = trimmed.length >= 2;

  useEffect(() => {
    if (!canSearch) {
      setProfiles([]);
      setError(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await searchUserProfiles(trimmed, 20);
        if (cancelled) return;
        if (result.error) {
          setError(result.error);
          setProfiles([]);
        } else {
          setProfiles(result.data || []);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Search failed');
          setProfiles([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, canSearch]);

  if (!canSearch) {
    return null;
  }

  if (loading) {
    return (
      <div className="space-y-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <ResultRowSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="py-8 text-center text-sm text-destructive">Could not search: {error}</p>
    );
  }

  return (
    <div>
      <p
        className="mb-2 text-[13px] font-bold uppercase tracking-[0.04em]"
        style={{ color: 'var(--muted-foreground)' }}
      >
        {profiles.length} creator{profiles.length === 1 ? '' : 's'}
      </p>
      {profiles.length === 0 ? (
        <p className="py-[30px] text-center text-muted-foreground">No matches. Try another name.</p>
      ) : (
        <div className="space-y-0.5">
          {profiles.map((profile) => (
            <ResultRow key={profile.id} profile={profile} />
          ))}
        </div>
      )}
    </div>
  );
}
