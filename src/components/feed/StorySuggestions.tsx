'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/contexts/user-context';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
interface SuggestionItem {
  id: string;
  full_name: string;
  username: string;
  avatar_url?: string;
}

interface StorySuggestionsProps {
  onPlusClick?: () => void;
  onStoryView?: () => void;
  refreshTrigger?: number;
}

function StoryRingSkeleton() {
  return (
    <div className="flex w-[66px] shrink-0 flex-col items-center gap-[7px]">
      <Skeleton className="h-[58px] w-[58px] rounded-full" />
      <Skeleton className="h-3 w-12 rounded" />
    </div>
  );
}

export function StorySuggestions({ onPlusClick, onStoryView, refreshTrigger }: StorySuggestionsProps) {
  const { profile: currentUserProfile } = useUser();
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [storyProfileIds, setStoryProfileIds] = useState<Set<string>>(new Set());
  const [liveProfileIds, setLiveProfileIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchSuggestions = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      let blockedUserIds: string[] = [];

      if (user?.id) {
        const { data: blocked, error: blockedError } = await supabase
          .from('blocked_users')
          .select('blockee_profile_id')
          .eq('blocker_profile_id', user.id);
        if (!blockedError && blocked) {
          blockedUserIds = blocked.map((b: { blockee_profile_id: string }) => b.blockee_profile_id);
        }
      }

      const { data, error: rpcError } = await supabase.rpc('get_suggested_story_profiles', {
        p_current_user_id: user?.id || null,
        p_limit: 12,
        p_offset: 0,
      });

      if (rpcError) {
        setError('Failed to load stories');
        return;
      }

      let filtered = (data || []) as SuggestionItem[];
      if (user?.id && blockedUserIds.length > 0) {
        filtered = filtered.filter((item) => !blockedUserIds.includes(item.id));
      }
      const profileIds = filtered.map((s) => s.id);
      const idsToCheck = user?.id
        ? [...new Set([user.id, ...profileIds])]
        : profileIds;

      if (idsToCheck.length > 0) {
        const { data: liveStories } = await supabase
          .from('live_stories')
          .select('profile_id')
          .in('profile_id', idsToCheck);

        const withStories = new Set<string>();
        for (const row of liveStories ?? []) {
          withStories.add((row as { profile_id: string }).profile_id);
        }
        setStoryProfileIds(withStories);
      } else {
        setStoryProfileIds(new Set());
      }

      setSuggestions(filtered);

      const suggestionIds = profileIds;
      if (suggestionIds.length > 0) {
        const { data: livePosts } = await supabase
          .from('posts')
          .select('user_id, post_media(metadata)')
          .eq('content_type', 'live_stream')
          .in('user_id', suggestionIds)
          .order('created_at', { ascending: false })
          .limit(30);

        const live = new Set<string>();
        for (const post of livePosts ?? []) {
          const media = (post as { post_media?: { metadata?: { status?: string } }[] }).post_media?.[0];
          if (media?.metadata?.status === 'live') {
            live.add((post as { user_id: string }).user_id);
          }
        }
        setLiveProfileIds(live);
      } else {
        setLiveProfileIds(new Set());
      }
    } catch {
      setError('Failed to load stories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSuggestions();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (refreshTrigger === undefined || refreshTrigger === 0) return;
    fetchSuggestions(true);
  }, [refreshTrigger]);

  if (loading) {
    return (
      <div className="scroll-x flex gap-4 border-b border-border px-[22px] py-4">
        <StoryRingSkeleton />
        {Array.from({ length: 6 }).map((_, i) => (
          <StoryRingSkeleton key={`story-skel-${i}`} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-b border-border px-[22px] py-4 text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  return (
    <div className="scroll-x flex gap-4 border-b border-border px-[22px] py-4">
      {currentUserProfile && (
        <div className="flex w-[66px] shrink-0 flex-col items-center gap-[7px]">
          <div className="relative">
            <Avatar
              className="h-[58px] w-[58px]"
              profileId={currentUserProfile.id}
              hasLiveStory={storyProfileIds.has(currentUserProfile.id)}
              showPlus
              plusSize="story"
              onPlusClick={onPlusClick}
              onStoryView={onStoryView}
            >
              <AvatarImage
                src={currentUserProfile.avatar_url || undefined}
                alt={currentUserProfile.full_name || currentUserProfile.username || 'Your avatar'}
              />
              <AvatarFallback className="text-base" />
            </Avatar>
          </div>
          <span className="max-w-[64px] truncate text-[11.5px] font-semibold text-muted-foreground">
            Your story
          </span>
        </div>
      )}

      {suggestions.map((suggestion) => {
        const isLive = liveProfileIds.has(suggestion.id);
        const firstName = (suggestion.full_name || suggestion.username).split(' ')[0];

        return (
          <div
            key={suggestion.id}
            className="flex w-[66px] shrink-0 flex-col items-center gap-[7px]"
          >
            <div className="relative">
              {isLive ? (
                <div
                  className="grid place-items-center rounded-full p-[2.5px]"
                  style={{ background: 'var(--brand-live)' }}
                >
                  <div className="rounded-full bg-background p-[2.5px]">
                    <Avatar
                      className="h-[58px] w-[58px]"
                      profileId={suggestion.id}
                      hasLiveStory={storyProfileIds.has(suggestion.id)}
                      username={suggestion.username}
                      onStoryView={onStoryView}
                    >
                      <AvatarImage
                        src={suggestion.avatar_url || undefined}
                        alt={suggestion.full_name || suggestion.username}
                      />
                      <AvatarFallback className="text-base" />
                    </Avatar>
                  </div>
                </div>
              ) : (
                <Avatar
                  className="h-[58px] w-[58px]"
                  profileId={suggestion.id}
                  hasLiveStory={storyProfileIds.has(suggestion.id)}
                  username={suggestion.username}
                  onStoryView={onStoryView}
                >
                  <AvatarImage
                    src={suggestion.avatar_url || undefined}
                    alt={suggestion.full_name || suggestion.username}
                  />
                  <AvatarFallback className="text-base" />
                </Avatar>
              )}
              {isLive && (
                <span
                  className="absolute bottom-px left-1/2 z-10 -translate-x-1/2 rounded-full py-px px-[7px] text-[9px] font-bold uppercase tracking-[0.05em] text-white"
                  style={{
                    background: 'var(--brand-live)',
                    border: '2px solid var(--background)',
                  }}
                >
                  LIVE
                </span>
              )}
            </div>
            <span className="max-w-[64px] truncate text-[11.5px] font-semibold text-muted-foreground">
              {firstName}
            </span>
          </div>
        );
      })}
    </div>
  );
}
