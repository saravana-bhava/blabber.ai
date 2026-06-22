'use client';

import { useState } from 'react';

import { Feed } from '@/components/feed/Feed';
import { NewPost } from '@/components/feed/NewPost';
import { FeedItemSkeleton } from '@/components/feed/FeedItemSkeleton';
import { NewPostSkeleton } from '@/components/feed/NewPostSkeleton';
import { StorySuggestions } from '@/components/feed/StorySuggestions';
import { StoryRecorder } from '@/components/feed/StoryRecorder';
import {
  FeedSpotlightCarousel,
  FeedSpotlightCarouselSkeleton,
} from '@/components/feed/feed-spotlight-carousel';
import { useUser } from '@/lib/contexts/user-context';
import { RequireAuth } from '@/components/auth/require-auth';
import { HomeFeedLayout } from '@/components/feed/home-feed-layout';

export default function HomePage() {
  const { session, profile, isLoading } = useUser();
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);
  const [storySuggestionsKey, setStorySuggestionsKey] = useState(0);
  const [isStoryRecorderOpen, setIsStoryRecorderOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const triggerFeedRefresh = () => {
    setFeedRefreshKey((prevKey) => prevKey + 1);
  };

  const handlePlusClick = () => {
    setIsStoryRecorderOpen(true);
  };

  const handleStoryComplete = () => {
    setIsStoryRecorderOpen(false);
    triggerFeedRefresh();
  };

  const showTopSections = !isLoading && session && profile;

  return (
    <RequireAuth>
      <HomeFeedLayout searchQuery={searchQuery} onSearchQueryChange={setSearchQuery}>
        <div className="home-feed-section border-b border-border">
          {isLoading ? (
            <NewPostSkeleton variant="feed" />
          ) : showTopSections ? (
            <NewPost variant="feed" onPostSuccess={triggerFeedRefresh} />
          ) : (
            <NewPostSkeleton variant="feed" />
          )}
        </div>
        {isLoading ? (
          <FeedSpotlightCarouselSkeleton />
        ) : showTopSections ? (
          <FeedSpotlightCarousel />
        ) : (
          <FeedSpotlightCarouselSkeleton />
        )}

        

        <div className="home-feed-section">
          {isLoading ? (
            <div className="scroll-x flex gap-4 border-b border-border px-[22px] py-4">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex w-[66px] shrink-0 flex-col items-center gap-1.5">
                  <div className="h-[58px] w-[58px] animate-pulse rounded-full bg-muted" />
                </div>
              ))}
            </div>
          ) : showTopSections ? (
            <StorySuggestions
              refreshTrigger={storySuggestionsKey}
              onPlusClick={handlePlusClick}
              onStoryView={() => {
                setStorySuggestionsKey((prev) => prev + 1);
              }}
            />
          ) : null}
        </div>

        <div>
          {isLoading ? (
            <div>
              {Array.from({ length: 3 }).map((_, i) => (
                <FeedItemSkeleton key={`main-skel-${i}`} />
              ))}
            </div>
          ) : showTopSections ? (
            <Feed key={feedRefreshKey} searchQuery={null} />
          ) : (
            <div>
              {Array.from({ length: 3 }).map((_, i) => (
                <FeedItemSkeleton key={`main-skel-${i}`} />
              ))}
            </div>
          )}
        </div>

        {session && profile && isStoryRecorderOpen && (
          <StoryRecorder
            isOpen={isStoryRecorderOpen}
            onClose={() => setIsStoryRecorderOpen(false)}
            onComplete={handleStoryComplete}
            profileId={profile.id}
          />
        )}
      </HomeFeedLayout>
    </RequireAuth>
  );
}
