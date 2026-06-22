'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LayoutGrid } from 'lucide-react';

import { Feed } from '@/components/feed/Feed';
import { FeedItemSkeleton } from '@/components/feed/FeedItemSkeleton';
import { ExploreSearch } from '@/components/feed/explore-search';
import { ExploreTrendingCreators } from '@/components/feed/explore-trending-creators';
import { ExploreUserResults } from '@/components/feed/explore-user-results';
import { HomeFeedLayout } from '@/components/feed/home-feed-layout';
import { useUser } from '@/lib/contexts/user-context';
import { RequireAuth } from '@/components/auth/require-auth';

function ExplorePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, profile, isLoading } = useUser();
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const q = debouncedSearchQuery.trim();
    const current = (searchParams.get('q') ?? '').trim();
    if (q === current) return;
    const url = q ? `/explore?q=${encodeURIComponent(q)}` : '/explore';
    router.replace(url, { scroll: false });
  }, [debouncedSearchQuery, router, searchParams]);

  const isSearching = debouncedSearchQuery.trim().length > 0;
  const showFeed = !isSearching && session && profile;

  return (
    <RequireAuth>
      <HomeFeedLayout
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searchPlaceholder="Search creators"
      >
        <div className="px-[22px] pb-[60px] pt-5">
          <ExploreSearch value={searchQuery} onChange={setSearchQuery} />

          {isSearching ? (
            <ExploreUserResults searchQuery={debouncedSearchQuery} />
          ) : (
            <>
              {isLoading ? (
                <div className="mb-7">
                  <div className="mb-3 h-5 w-40 animate-pulse rounded bg-muted" />
                  <div className="scroll-x -mx-[22px] flex gap-3 px-[22px]">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-[196px] w-[168px] shrink-0 animate-pulse rounded-[14px] bg-muted"
                      />
                    ))}
                  </div>
                </div>
              ) : session && profile ? (
                <ExploreTrendingCreators />
              ) : null}

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <LayoutGrid
                    className="h-[17px] w-[17px] shrink-0 text-[var(--brand-violet)]"
                    aria-hidden
                  />
                  <h2 className="font-display text-lg text-foreground">Popular this week</h2>
                </div>
                {isLoading ? (
                  <div>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <FeedItemSkeleton key={`explore-skel-${i}`} />
                    ))}
                  </div>
                ) : showFeed ? (
                  <Feed searchQuery={null} activeTab="explore" />
                ) : (
                  <div>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <FeedItemSkeleton key={`explore-skel-${i}`} />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </HomeFeedLayout>
    </RequireAuth>
  );
}

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <main className="home-feed-layout flex h-full min-h-0 min-w-0 flex-col">
          <div className="home-feed-scroll scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-[22px] py-5">
            <div className="mb-[22px] h-[52px] animate-pulse rounded-full bg-muted" />
            {Array.from({ length: 3 }).map((_, i) => (
              <FeedItemSkeleton key={i} />
            ))}
          </div>
        </main>
      }
    >
      <ExplorePageContent />
    </Suspense>
  );
}
