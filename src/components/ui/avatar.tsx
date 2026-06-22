"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { StoryViewer } from '@/components/feed/StoryViewer'
import { useRouter } from 'next/navigation'

// Extend Avatar props
export type AvatarProps = React.ComponentProps<typeof AvatarPrimitive.Root> & {
  hasLiveStory?: boolean; // for backward compatibility
  showPlus?: boolean; // for backward compatibility
  onPlusClick?: () => void;
  onRingClick?: () => void;
  onStoryView?: () => void;
  profileId?: string;
  username?: string; // Add username for navigation
  isOwnProfilePage?: boolean;
  /** Dim story strip: 22px gradient badge; profile header uses larger control */
  plusSize?: 'story' | 'md';
};

export function Avatar({
  className,
  hasLiveStory: hasLiveStoryProp,
  showPlus: showPlusProp,
  onPlusClick,
  onRingClick,
  onStoryView,
  profileId,
  username,
  isOwnProfilePage,
  plusSize = 'md',
  children,
  ...props
}: AvatarProps) {
  const router = useRouter();
  const [hasLiveStory, setHasLiveStory] = React.useState<boolean>(!!hasLiveStoryProp);
  const [allStoriesViewed, setAllStoriesViewed] = React.useState<boolean>(false);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [isStoryViewerOpen, setIsStoryViewerOpen] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    if (hasLiveStoryProp !== undefined) {
      setHasLiveStory(!!hasLiveStoryProp);
    }
  }, [hasLiveStoryProp]);

  React.useEffect(() => {
    if (!profileId) return;
    let mounted = true;
    setLoading(true);
    const supabase = createClient();
    
    // Check if profile has stories and if current user has viewed all of them
    const checkStoriesAndViews = async () => {
      try {
        // Get all stories for this profile
        const { data: stories, error: storiesError } = await supabase
          .from('live_stories')
          .select('id')
          .eq('profile_id', profileId);
        
        if (!mounted) return;
        
        if (storiesError || !stories || stories.length === 0) {
          setHasLiveStory(false);
          setAllStoriesViewed(false);
          setLoading(false);
          return;
        }
        
        setHasLiveStory(true);
        
        // Get current user to check if they've viewed all stories
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setAllStoriesViewed(false);
          setLoading(false);
          return;
        }
        
        // Check if user has viewed all stories for this profile
        const { data: viewedStories, error: viewsError } = await supabase
          .from('user_story_views')
          .select('story_id')
          .in('story_id', stories.map(s => s.id))
          .eq('viewer_profile_id', user.id);
        
        if (!mounted) return;
        
        if (viewsError) {
          setAllStoriesViewed(false);
        } else {
          const viewedStoryIds = new Set(viewedStories?.map(v => v.story_id) || []);
          const allStoryIds = new Set(stories.map(s => s.id));
          setAllStoriesViewed(viewedStoryIds.size === allStoryIds.size && allStoryIds.size > 0);
        }
        
        setLoading(false);
      } catch (error) {
        if (mounted) {
          setHasLiveStory(false);
          setAllStoriesViewed(false);
          setLoading(false);
        }
      }
    };
    
    checkStoriesAndViews();
    
    return () => {
      mounted = false;
    };
  }, [profileId, refreshKey]);

  // Determine if we should show the plus icon
  const showPlus = showPlusProp ?? !!isOwnProfilePage;

  // Ring wrapper logic
  const ring = (
    <span
      className={cn(
        "absolute inset-0 z-0 rounded-full pointer-events-none",
        loading
          ? "ring-2 ring-gray-300 ring-offset-2 ring-offset-background animate-pulse"
          : hasLiveStory
            ? allStoriesViewed
              ? "ring-2 ring-gray-400 ring-offset-2 ring-offset-background"
              : "ring-2 ring-pink-500 ring-offset-2 ring-offset-background bg-gradient-to-tr from-pink-400 via-red-400 to-yellow-400 animate-story-ring"
            : ""
      )}
      aria-hidden="true"
    />
  );

  const handleClick = () => {
    if (loading) return;
    if (hasLiveStory) {
      setIsStoryViewerOpen(true);
      return;
    }
    if (showPlus && onPlusClick) {
      onPlusClick();
      return;
    }
    if (username && profileId) {
      router.push(`/u/${username}`);
    }
  };

  const isClickable =
    !!profileId && (hasLiveStory || !!username || (showPlus && !!onPlusClick));

  const plusButton = showPlus ? (
    <button
      type="button"
      className={cn(
        'absolute z-20 flex items-center justify-center rounded-full border-background text-white transition-opacity hover:opacity-90',
        plusSize === 'story'
          ? '-bottom-px -right-px h-[22px] w-[22px] border-[2.5px]'
          : 'bottom-0 right-0 h-8 w-8 border shadow-md'
      )}
      style={{ background: 'var(--brand-grad)' }}
      onClick={e => {
        e.stopPropagation();
        onPlusClick?.();
      }}
      tabIndex={0}
      aria-label="Add Story"
    >
      <Plus size={plusSize === 'story' ? 13 : 16} strokeWidth={plusSize === 'story' ? 3 : 2.5} />
    </button>
  ) : null;

  return (
    <>
      <AvatarPrimitive.Root data-slot="avatar" {...props} className="relative flex shrink-0 rounded-full">
        <span
          className={cn(
            "relative flex size-8 shrink-0 rounded-full",
            className
          )}
        >
          {(hasLiveStory || loading) && ring}
          {isClickable ? (
            <button
              type="button"
              onClick={handleClick}
              disabled={loading}
              className="relative z-10 flex size-full shrink-0 rounded-full border-none p-0 bg-transparent cursor-pointer focus:outline-none transition-opacity disabled:cursor-wait"
              tabIndex={0}
              style={{ border: 'none', background: 'transparent' }}
              aria-label={
                hasLiveStory
                  ? 'View story'
                  : showPlus && onPlusClick
                    ? 'Add story'
                    : 'View profile'
              }
            >
              {children}
            </button>
          ) : (
            <span className="relative z-10 block size-full">{children}</span>
          )}
          {plusButton}
        </span>
      </AvatarPrimitive.Root>
      {profileId && isStoryViewerOpen && (
        <StoryViewer
          isOpen={isStoryViewerOpen}
          onClose={() => {
            setIsStoryViewerOpen(false);
            setRefreshKey(k => k + 1);
            onStoryView?.();
          }}
          onComplete={() => {
            setIsStoryViewerOpen(false);
            setRefreshKey(k => k + 1);
            onStoryView?.();
          }}
          profileId={profileId}
        />
      )}
    </>
  );
}

export function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full object-cover rounded-full overflow-hidden", className)}
      {...props}
    />
  )
}

export function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "relative flex size-full items-center justify-center rounded-full overflow-hidden text-white font-semibold text-sm",
        className
      )}
      {...props}
    >
      <img
        src="/placeholder-b.png"
        alt="Avatar placeholder"
        className="absolute inset-0 w-full h-full object-cover rounded-full"
        style={{ zIndex: 0 }}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
      <span className="relative z-10">{props.children}</span>
    </AvatarPrimitive.Fallback>
  )
}
