'use client';

import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
// import { createClient } from '@/lib/supabase/client'; // No longer needed for direct fetch
import { 
  getFeedPostsWithInteractions, 
  getExplorePostsWithInteractions,
  getShortsPostsWithInteractions,
  getExplorePostsWithInteractionsEngagement
} from '@/app/actions/postActions'; // Import all functions
import { Post } from '@/lib/types';
import { FeedItem } from './FeedItem';
import { FeedItemShort } from './FeedItemShort';
import { FeedGridItem } from './FeedGridItem';
import { FeedItemSkeleton } from './FeedItemSkeleton'; // Import the new skeleton component
import { useUser } from '@/lib/contexts/user-context';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const POSTS_PER_PAGE = 10;

interface FeedProps {
  profileUserId?: string | null; // Posts by this user
  bookmarkedByUserId?: string | null; // Posts bookmarked by this user
  searchQuery?: string | null; // Search query for explore tab
  activeTab?: 'home' | 'explore' | 'shorts'; // Optional: override activeTab
  /** Replaces the default empty-state message when the feed has no posts. */
  emptyState?: ReactNode;
  // Consider adding a key prop if Feed can be re-used on same page with different filters
  // e.g. key={profileUserId || bookmarkedByUserId || 'general'}
}

// Mobile detection hook
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [breakpoint]);
  return isMobile;
}

export function Feed({ profileUserId = null, bookmarkedByUserId = null, searchQuery = null, activeTab: propActiveTab, emptyState }: FeedProps) {
  const { session, profile, isLoading } = useUser();
  const activeTab = propActiveTab;
  // const supabase = createClient(); // No longer needed for direct fetch
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const observer = useRef<IntersectionObserver | null>(null);
  const [activeShortIndex, setActiveShortIndex] = useState(0); // Track which short is in view
  const shortsRefs = useRef<(HTMLDivElement | null)[]>([]); // Refs for each short
  const shortsObserver = useRef<IntersectionObserver | null>(null); // Separate observer for shorts
  const isMobile = useIsMobile();
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]); // Store blocked user IDs
  const [blockedLoaded, setBlockedLoaded] = useState(false); // Track if blocked users are loaded

  // Create a dependency array for fetchPosts based on filters
  // This ensures fetchPosts is re-created if filters change, triggering useEffect for re-fetch
  const fetchDependencies = [profileUserId, bookmarkedByUserId, activeTab, searchQuery, blockedUserIds];

  const fetchPosts = useCallback(async (fetchOffset: number) => {
    setLoading(true);
    // setError(null); // setError is handled based on response

    try {
      let contentType = null;
      if (activeTab === 'shorts') {
        contentType = 'short';
      }
      // Use different functions based on the active tab
      let result;
      if (activeTab === 'explore') {
        // Use the engagement-ordered function for explore tab
        result = await getExplorePostsWithInteractionsEngagement(
          fetchOffset, 
          POSTS_PER_PAGE,
          profileUserId,
          bookmarkedByUserId,
          searchQuery
        );
      } else if (activeTab === 'shorts') {
        // Use the engagement-ordered function for shorts tab
        result = await getShortsPostsWithInteractions(
          fetchOffset, 
          POSTS_PER_PAGE,
          profileUserId,
          bookmarkedByUserId,
          searchQuery
        );
      } else {
        // Use the regular function for other tabs (home)
        result = await getFeedPostsWithInteractions(
          fetchOffset, 
          POSTS_PER_PAGE,
          profileUserId,
          bookmarkedByUserId,
          contentType
        );
      }

      if (result.error) {
        console.error("Error fetching posts via server action:", result.error);
        setError(result.error);
        // Optionally, setHasMore(false) if an error means we can't fetch more
      } else if (result.data) {
        let postsData = result.data || [];
        // Always filter out posts from blocked users
        if (blockedUserIds.length > 0) {
          postsData = postsData.filter((p: any) => !blockedUserIds.includes(p.user_id));
        }
        
        setPosts(prevPosts => {
          if (fetchOffset === 0) return postsData;
          if (activeTab === 'explore') {
            const existingIds = new Set(prevPosts.map(p => p.id));
            const deduped = [...prevPosts, ...postsData.filter(p => !existingIds.has(p.id))];
            return deduped;
          }
          return [...prevPosts, ...postsData];
        });
        setHasMore(result.hasMore);
        setError(null); // Clear error on successful fetch
      } else {
        // Handle case where data is null but no error (should ideally not happen with current action structure)
        setHasMore(false);
      }
    } catch (err: any) {
      // This catch block is for unexpected errors during the action call itself (e.g., network issue client-side)
      console.error("Client-side error calling fetchPosts action:", err);
      setError(err.message || 'Failed to fetch posts due to a client-side issue');
    } finally {
      setLoading(false);
    }
  }, [profileUserId, bookmarkedByUserId, activeTab, searchQuery, blockedUserIds]);

  // Fetch blocked users once per feed render or when session changes
  async function fetchBlockedUsers(isMounted = true) {
    if (profile?.id) {
      const supabase = (await import('@/lib/supabase/client')).createClient();
      const { data: blocked, error: blockedError } = await supabase
        .from('blocked_users')
        .select('blockee_profile_id')
        .eq('blocker_profile_id', profile.id);
      if (!blockedError && blocked) {
        setBlockedUserIds(blocked.map((b: any) => b.blockee_profile_id));
      } 
    } 
    setBlockedLoaded(true);
  }

  useEffect(() => {
    let isMounted = true;
    setBlockedLoaded(false); // Reset loading state on session change
    fetchBlockedUsers(isMounted);
    return () => { isMounted = false; };
  }, []);

  // Log blockedUserIds when it changes
  useEffect(() => {
  }, [blockedUserIds]);

  const refreshFeed = useCallback(() => {
    setPosts([]); // Clear previous posts for a fresh load
    setHasMore(true); // Reset hasMore on filter change
    setError(null); // Clear previous errors
    fetchPosts(0); // Initial fetch
  }, [fetchPosts]);

  // Only fetch posts when blocked users are loaded and filters change
  useEffect(() => {
    if (blockedLoaded) {
      refreshFeed();
    }
  }, [profileUserId, bookmarkedByUserId, activeTab, searchQuery, blockedLoaded]);

  const lastPostElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        fetchPosts(posts.length); // Use posts.length as the offset
      }
    });

    if (node) observer.current.observe(node);
  }, [loading, hasMore, posts.length, fetchPosts]);

  // Intersection Observer for shorts
  useEffect(() => {
    if (activeTab !== 'shorts') {
      // Clean up observer when leaving shorts tab
      if (shortsObserver.current) {
        shortsObserver.current.disconnect();
        shortsObserver.current = null;
      }
      return;
    }
    
    // Clean up existing observer
    if (shortsObserver.current) {
      shortsObserver.current.disconnect();
    }
    
    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const idx = shortsRefs.current.findIndex((el) => el === entry.target);
          if (idx !== -1) {
            setActiveShortIndex(idx);
          }
        }
      });
    };
    
    shortsObserver.current = new window.IntersectionObserver(handleIntersect, {
      root: null,
      threshold: 0.6, // 60% of the short must be visible
    });
    
    // Observe all current refs
    shortsRefs.current.forEach((ref, index) => {
      if (ref && shortsObserver.current) {
        shortsObserver.current.observe(ref);
      }
    });
    
    return () => {
      if (shortsObserver.current) {
        shortsObserver.current.disconnect();
        shortsObserver.current = null;
      }
    };
  }, [posts, activeTab]);

  // Clear shortsRefs when leaving shorts tab
  useEffect(() => {
    if (activeTab !== 'shorts') {
      shortsRefs.current = [];
      setActiveShortIndex(0);
    }
  }, [activeTab]);

  // Debug effect to log shouldPlay values
  useEffect(() => {
    if (activeTab === 'shorts') {
      posts.forEach((post, index) => {
      });
    }
  }, [activeShortIndex, posts.length, activeTab]);

  // Debug effect to monitor posts state changes
  useEffect(() => {
    if (activeTab === 'explore') {
    }
  }, [posts, activeTab]);

  // Global effect: pause all <video> elements on tab change (diagnostic hack)
  useEffect(() => {
    document.querySelectorAll('video').forEach(v => v.pause());
  }, [activeTab]);

  if (posts.length === 0 && loading) {
    return (
      <div>
        {[...Array(3)].map((_, i) => <FeedItemSkeleton key={`skel-${i}`} />)}
      </div>
    );
  }

  if (error && posts.length === 0) {
    return <div className="text-red-500 text-center p-4">Error: {error}</div>;
  }

  // Updated empty state message based on filters
  let emptyMessage = "No posts yet.";
  if (profileUserId && !bookmarkedByUserId) {
    emptyMessage = "This user hasn't posted anything yet.";
  } else if (bookmarkedByUserId && !profileUserId) {
    emptyMessage = "You haven't bookmarked any posts yet.";
  } else if (profileUserId && bookmarkedByUserId) {
    emptyMessage = "This user hasn't bookmarked any posts / No bookmarked posts by this user found."; // Or more specific
  } else if (activeTab === 'shorts') {
    emptyMessage = "No shorts found.";
  } else if (activeTab === 'explore') {
    emptyMessage = "No visual content found.";
  }

  if (posts.length === 0 && !loading) {
    if (emptyState) return <>{emptyState}</>;
    return (
      <>
        <div className="text-center text-muted-foreground p-4 pt-8">{emptyMessage}</div>
      </>
    );
  }

  return (
    <div>
      {activeTab === 'shorts' ? (
        <div
          className="overflow-y-auto snap-y snap-mandatory"
          style={{
            height: isMobile
              ? 'calc(100vh - 72px - 56px)'
              : 'calc(100vh - 72px)',
          }}
        >
          {posts.map((post, index) => (
            <div
              key={post.id}
              ref={el => { shortsRefs.current[index] = el; }}
              className="flex items-center justify-center snap-start"
              style={{
                height: isMobile
                  ? 'calc(100vh - 72px - 56px)'
                  : 'calc(100vh - 72px)',
              }}
            >
              <FeedItemShort post={post} onPostDelete={refreshFeed} shouldPlay={activeShortIndex === index} />
            </div>
          ))}
        </div>
      ) : activeTab === 'explore' ? (
        <div className={cn(
          "grid grid-cols-3 gap-2",
          isMobile ? "auto-rows-[33vw]" : "auto-rows-[min(25vw,220px)]"
        )}>
          {posts.map((post, index) => (
            <div 
              key={`${post.id}-${index}`} 
              ref={index >= posts.length - 3 ? lastPostElementRef : null}
              style={{ gridRow: `span ${(post.content_type as string) === 'short' ? 2 : 1}` }}
              className={cn(
                "relative h-full overflow-hidden rounded-[14px] border border-border",
                (post.content_type as string) === 'short' ? 'pb-[200%]' : 'pb-[100%]'
              )}
            >
              <div className="absolute inset-0">
                <FeedGridItem 
                  post={post} 
                  onPostClick={() => {}} 
                  onPostDelete={refreshFeed}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          {posts.map((post, index) => (
            <div key={post.id} ref={index === posts.length - 1 ? lastPostElementRef : null}>
              <FeedItem post={post} onPostDelete={refreshFeed} />
            </div>
          ))}
        </div>
      )}
      {loading && posts.length > 0 && (
        <div className="mt-0">
            {[...Array(1)].map((_, i) => <FeedItemSkeleton key={`loading-skel-${i}`} />)}
        </div>
      )} 
    </div>
  );
} 