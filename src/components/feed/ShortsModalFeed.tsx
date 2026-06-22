'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { 
  getShortsPostsWithInteractions,
} from '@/app/actions/postActions';
import { Post } from '@/lib/types';
import { FeedItemShort } from './FeedItemShort';
import { FeedItemSkeleton } from './FeedItemSkeleton';
import { useUser } from '@/lib/contexts/user-context';

const POSTS_PER_PAGE = 10;

interface ShortsModalFeedProps {
  onPostDelete?: () => void;
  initialPostId?: string;
}

export function ShortsModalFeed({ onPostDelete, initialPostId }: ShortsModalFeedProps) {
  const { session, profile, isLoading } = useUser();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeShortIndex, setActiveShortIndex] = useState(0);
  const shortsRefs = useRef<(HTMLDivElement | null)[]>([]);
  const shortsObserver = useRef<IntersectionObserver | null>(null);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [blockedLoaded, setBlockedLoaded] = useState(false);
  const [consecutiveEmptyFetches, setConsecutiveEmptyFetches] = useState(0);
  const initialScrollDone = useRef(false);

  // Fetch blocked users
  async function fetchBlockedUsers(isMounted = true) {
    if (profile?.id) {
      const supabase = (await import('@/lib/supabase/client')).createClient();
      const { data: blocked, error: blockedError } = await supabase
        .from('blocked_users')
        .select('blockee_profile_id')
        .eq('blocker_profile_id', profile.id);
      if (!blockedError && blocked && isMounted) {
        setBlockedUserIds(blocked.map((b: any) => b.blockee_profile_id));
      } else if (isMounted) {
        setBlockedUserIds([]);
      }
    } else if (isMounted) {
      setBlockedUserIds([]);
    }
    if (isMounted) setBlockedLoaded(true);
  }

  const fetchPosts = useCallback(async (fetchOffset: number) => {
    setLoading(true);

    try {
      const result = await getShortsPostsWithInteractions(
        fetchOffset, 
        POSTS_PER_PAGE,
        null, // profileUserId
        null, // bookmarkedByUserId
        null  // searchQuery
      );

      if (result.error) {
        console.error("Error fetching posts via server action:", result.error);
        setError(result.error);
      } else if (result.data) {
        let postsData = result.data || [];
        
        // Filter out posts from blocked users
        if (blockedUserIds.length > 0) {
          const beforeFilter = postsData.length;
          postsData = postsData.filter((p: any) => !blockedUserIds.includes(p.user_id));
        }
        
        
        setPosts(prevPosts => {
          if (fetchOffset === 0) return postsData;
          return [...prevPosts, ...postsData];
        });
        
        // Handle case where all posts are filtered out
        if (postsData.length === 0 && result.data.length > 0) {
          const newConsecutiveEmpty = consecutiveEmptyFetches + 1;
          setConsecutiveEmptyFetches(newConsecutiveEmpty);
          
          // If we've had 3 consecutive empty fetches, stop trying
          if (newConsecutiveEmpty >= 3) {
            setHasMore(false);
          } else {
            setHasMore(result.hasMore);
          }
        } else {
          // Reset consecutive empty counter if we got some posts
          setConsecutiveEmptyFetches(0);
          setHasMore(result.hasMore);
        }
        setError(null);
      } else {
        setHasMore(false);
      }
    } catch (err: any) {
      console.error("Client-side error calling fetchPosts action:", err);
      setError(err.message || 'Failed to fetch posts due to a client-side issue');
    } finally {
      setLoading(false);
    }
  }, [blockedUserIds, consecutiveEmptyFetches]);

  const refreshFeed = useCallback(() => {
    setPosts([]);
    setHasMore(true);
    setError(null);
    setConsecutiveEmptyFetches(0);
    fetchPosts(0);
  }, [fetchPosts]);

  // Fetch blocked users on mount
  useEffect(() => {
    let isMounted = true;
    setBlockedLoaded(false);
    fetchBlockedUsers(isMounted);
    return () => { isMounted = false; };
  }, []);

  // Only fetch posts when blocked users are loaded
  useEffect(() => {
    if (blockedLoaded) {
      refreshFeed();
    }
  }, [blockedLoaded, refreshFeed]);

  // Debug effect to monitor posts state changes
  useEffect(() => {
  }, [posts.length, hasMore, loading]);

  // Intersection Observer for shorts
  useEffect(() => {
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
      threshold: 0.6,
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
  }, [posts]);

  // Global effect: pause all <video> elements on mount
  useEffect(() => {
    document.querySelectorAll('video').forEach(v => v.pause());
  }, []);

  // Scroll to initial post when opening from discovery grid
  useEffect(() => {
    if (!initialPostId || posts.length === 0 || initialScrollDone.current) return;
    const idx = posts.findIndex((p) => p.id === initialPostId);
    if (idx <= 0) {
      initialScrollDone.current = true;
      if (idx === 0) setActiveShortIndex(0);
      return;
    }
    const el = shortsRefs.current[idx];
    if (el) {
      el.scrollIntoView({ behavior: 'auto', block: 'start' });
      setActiveShortIndex(idx);
    }
    initialScrollDone.current = true;
  }, [posts, initialPostId]);

  useEffect(() => {
    initialScrollDone.current = false;
  }, [initialPostId]);

  // if (posts.length === 0 && loading) {
  //   return (
  //     <div>
  //       {[...Array(3)].map((_, i) => <FeedItemSkeleton key={`skel-${i}`} />)}
  //     </div>
  //   );
  // }

  if (error && posts.length === 0) {
    return <div className="text-red-500 text-center p-4">Error: {error}</div>;
  }

  if (posts.length === 0 && !loading) {
    return (
      <div className="text-center text-white p-4 pt-8">No shorts found.</div>
    );
  }

  return (
    <div
      className="shorts-modal-feed-container overflow-y-auto snap-y snap-mandatory w-full h-full !border-0"
    >
      <style>{`
        .shorts-modal-feed-container, .shorts-modal-feed-item {
          height: 100dvh;
          max-height: 100dvh;
        }
        @media (max-width: 767px) {
          .shorts-modal-feed-container, .shorts-modal-feed-item {
            height: calc(100dvh - 4rem);
            max-height: calc(100dvh - 4rem);
          }
        }
      `}</style>
      {posts.map((post, index) => (
        <div
          key={post.id}
          ref={el => { shortsRefs.current[index] = el; }}
          className="shorts-modal-feed-item flex items-center justify-center snap-start w-full"
        >
          <FeedItemShort 
            post={post} 
            onPostDelete={refreshFeed} 
            shouldPlay={activeShortIndex === index}
            shouldRender={Math.abs(activeShortIndex - index) <= 1}
          />
        </div>
      ))}
      {loading && posts.length > 0 && (
        <div className="mt-0">
            {[...Array(1)].map((_, i) => <FeedItemSkeleton key={`loading-skel-${i}`} />)}
        </div>
      )} 
    </div>
  );
} 