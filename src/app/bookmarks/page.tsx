'use client';

import { useEffect, useState } from 'react';
import { Bookmark } from 'lucide-react';

import { Feed } from '@/components/feed/Feed';
import { FeedItemSkeleton } from '@/components/feed/FeedItemSkeleton';
import { PageShell } from '@/components/layout/page-header';
import { useUser } from '@/lib/contexts/user-context';
import { RequireAuth } from '@/components/auth/require-auth';
import { AdminGradButton } from '@/components/admin/admin-ui';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

type BookmarkTab = 'home' | 'shorts';

function BookmarkTabs({
  activeTab,
  onChange,
}: {
  activeTab: BookmarkTab;
  onChange: (tab: BookmarkTab) => void;
}) {
  const tabs: { id: BookmarkTab; label: string }[] = [
    { id: 'home', label: 'Feed' },
    { id: 'shorts', label: 'Shorts' },
  ];

  return (
    <div
      className="flex shrink-0 gap-1 rounded-full border border-border p-1"
      style={{ background: 'var(--brand-surface)' }}
      role="tablist"
      aria-label="Bookmark content type"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              'shrink-0 rounded-full px-3 py-[7px] text-[12.5px] font-semibold transition-[color,background,box-shadow] duration-150 md:px-[15px] md:text-[13px]',
              isActive
                ? 'text-[var(--brand-on-accent)]'
                : 'text-muted-foreground hover:text-foreground',
            )}
            style={
              isActive
                ? { background: 'var(--brand-grad)', boxShadow: 'var(--brand-ring-money)' }
                : undefined
            }
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function BookmarksEmptyState({ variant = 'feed' }: { variant?: 'feed' | 'shorts' }) {
  const isShorts = variant === 'shorts';
  return (
    <div className="grid min-h-[50vh] place-items-center px-10 py-16 text-center">
      <div className="max-w-[360px]">
        <div
          className="mx-auto mb-4 grid h-[60px] w-[60px] place-items-center rounded-[18px] text-muted-foreground/70"
          style={{ background: 'var(--secondary)' }}
        >
          <Bookmark className="h-[26px] w-[26px]" aria-hidden />
        </div>
        <h2 className="font-display text-xl tracking-tight mb-2">
          {isShorts ? 'No saved shorts yet' : 'No bookmarks yet'}
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {isShorts
            ? 'Bookmark a short from the feed and it will show up here.'
            : 'Tap the bookmark icon on any post to save it here for later.'}
        </p>
      </div>
    </div>
  );
}

function savedSubtitle(count: number | null, tab: BookmarkTab): string | undefined {
  if (count === null) return undefined;
  const label = tab === 'shorts' ? 'short' : 'post';
  return `${count} saved ${label}${count === 1 ? '' : 's'}`;
}

export default function BookmarksPage() {
  const supabase = createClient();
  const { session, profile, isLoading } = useUser();
  const [activeTab, setActiveTab] = useState<BookmarkTab>('home');
  const [savedCount, setSavedCount] = useState<number | null>(null);

  useEffect(() => {
    if (!profile?.id) return;

    let cancelled = false;
    (async () => {
      const { count, error } = await supabase
        .from('user_post_interactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('interaction_type', 'post_save');

      if (!cancelled && !error) {
        setSavedCount(count ?? 0);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.id, supabase]);

  const tabs = <BookmarkTabs activeTab={activeTab} onChange={setActiveTab} />;
  const subtitle = savedSubtitle(savedCount, activeTab);
  const scrollClassName = 'max-md:pb-[calc(4rem+env(safe-area-inset-bottom,0px))]';

  if (isLoading) {
    return (
      <RequireAuth>
        <PageShell title="Bookmarks" subtitle={subtitle} rightActions={tabs} scrollClassName={scrollClassName}>
          <div className="mx-auto w-full max-w-[680px]">
            {Array.from({ length: 3 }).map((_, i) => (
              <FeedItemSkeleton key={`skel-bm-${i}`} />
            ))}
          </div>
        </PageShell>
      </RequireAuth>
    );
  }

  if (!session || !profile) {
    return (
      <RequireAuth>
        <PageShell title="Bookmarks" scrollClassName={scrollClassName}>
          <div className="mx-auto w-full max-w-[680px] px-[22px] py-10">
            <p className="text-muted-foreground text-sm mb-5">
              Please log in to see your bookmarked posts.
            </p>
            <AdminGradButton onClick={() => window.location.assign('/login')}>
              Log in
            </AdminGradButton>
          </div>
        </PageShell>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <PageShell
        title="Bookmarks"
        subtitle={subtitle}
        rightActions={tabs}
        scrollClassName={scrollClassName}
      >
        <div className="mx-auto w-full max-w-[680px] pb-[60px]">
          <Feed
            bookmarkedByUserId={profile.id}
            key={`bookmarks-${profile.id}-${activeTab}`}
            activeTab={activeTab}
            emptyState={<BookmarksEmptyState variant={activeTab === 'shorts' ? 'shorts' : 'feed'} />}
          />
        </div>
      </PageShell>
    </RequireAuth>
  );
}
