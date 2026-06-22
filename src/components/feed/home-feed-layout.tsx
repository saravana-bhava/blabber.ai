'use client';

import { FeedHeader } from '@/components/feed/feed-header';

type HomeFeedLayoutProps = {
  children: React.ReactNode;
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
  searchPlaceholder?: string;
};

/**
 * Dim home feed column: pinned FeedHeader + scrollable content stack (max 740px).
 * Scroll lives in full-width `.home-feed-scroll` (scrollbar on the column’s right edge).
 */
export function HomeFeedLayout({
  children,
  searchQuery,
  onSearchQueryChange,
  searchPlaceholder,
}: HomeFeedLayoutProps) {
  return (
    <main className="home-feed-layout flex h-full min-h-0 min-w-0 flex-col">
      <FeedHeader
        pinned
        searchQuery={searchQuery}
        onSearchQueryChange={onSearchQueryChange}
        searchPlaceholder={searchPlaceholder}
      />
      <div
        className="home-feed-scroll scrollbar-hide min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain max-md:pb-[calc(4rem+env(safe-area-inset-bottom,0px))]"
        data-lenis-prevent
      >
        <div className="home-feed-content mx-auto w-full max-w-[740px]">
          {children}
        </div>
      </div>
    </main>
  );
}