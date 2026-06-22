'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Loader2, MoreHorizontal, Trash2, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/contexts/user-context';
import { cn } from '@/lib/utils';
import { getStoryMediaKind } from '@/lib/utils/story-media';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface StoryViewerProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (data: any) => void;
  profileId: string;
}

interface StoryProfile {
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

const DEFAULT_STORY_DURATION = 10000;
const SWIPE_THRESHOLD = 100;
const SWIPE_VELOCITY_THRESHOLD = 0.5;

function formatStoryTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return 'Yesterday';
}

export function StoryViewer({ isOpen, onClose, onComplete, profileId }: StoryViewerProps) {
  const { profile } = useUser();
  const [stories, setStories] = useState<any[]>([]);
  const [storyProfile, setStoryProfile] = useState<StoryProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [preloading, setPreloading] = useState(false);
  const [current, setCurrent] = useState(0);
  const [progress, setProgress] = useState(0);
  const [preloadedMedia, setPreloadedMedia] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [storyDurations, setStoryDurations] = useState<Map<string, number>>(new Map());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressRef = useRef<NodeJS.Timeout | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ y: number; time: number } | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const [renderAsVideo, setRenderAsVideo] = useState(false);

  const isOwnStory = profile?.id === profileId;
  const displayName = storyProfile?.full_name || storyProfile?.username || 'Story';

  const getCurrentStoryDuration = useCallback(() => {
    if (!stories[current]) return DEFAULT_STORY_DURATION;
    const story = stories[current];
    return storyDurations.get(story.media_url) || DEFAULT_STORY_DURATION;
  }, [current, stories, storyDurations]);

  const preloadMedia = useCallback(async (stories: any[]) => {
    if (stories.length === 0) return;

    setPreloading(true);
    const preloaded = new Set<string>();
    const durations = new Map<string, number>();

    const preloadPromises = stories.map((story) => {
      return new Promise<void>((resolve) => {
        const kind = getStoryMediaKind(story.media_url);

        if (kind === 'image') {
          const img = new Image();
          img.onload = () => {
            preloaded.add(story.media_url);
            durations.set(story.media_url, DEFAULT_STORY_DURATION);
            resolve();
          };
          img.onerror = () => {
            durations.set(story.media_url, DEFAULT_STORY_DURATION);
            resolve();
          };
          img.src = story.media_url;
        } else if (kind === 'video') {
          const video = document.createElement('video');
          video.preload = 'metadata';
          video.onloadedmetadata = () => {
            preloaded.add(story.media_url);
            const duration = Math.max(3000, video.duration * 1000);
            durations.set(story.media_url, duration);
            resolve();
          };
          video.onerror = () => {
            durations.set(story.media_url, DEFAULT_STORY_DURATION);
            resolve();
          };
          video.src = story.media_url;
        } else {
          durations.set(story.media_url, DEFAULT_STORY_DURATION);
          resolve();
        }
      });
    });

    await Promise.all(preloadPromises);
    setPreloadedMedia(preloaded);
    setStoryDurations(durations);
    setPreloading(false);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { y: touch.clientY, time: Date.now() };
    setIsDragging(true);
    setDragOffset(0);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || !isDragging) return;

    const touch = e.touches[0];
    const deltaY = touch.clientY - touchStartRef.current.y;

    if (deltaY > 0) {
      setDragOffset(deltaY);
      e.preventDefault();
    }
  }, [isDragging]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || !isDragging) return;

    const touch = e.changedTouches[0];
    const deltaY = touch.clientY - touchStartRef.current.y;
    const deltaTime = Date.now() - touchStartRef.current.time;
    const velocity = deltaY / deltaTime;

    if (deltaY > SWIPE_THRESHOLD || velocity > SWIPE_VELOCITY_THRESHOLD) {
      onClose();
    }

    setIsDragging(false);
    setDragOffset(0);
    touchStartRef.current = null;
  }, [isDragging, onClose]);

  const goToNext = useCallback(() => {
    if (current < stories.length - 1) {
      setCurrent((c) => c + 1);
    } else {
      onClose();
      setTimeout(() => {
        setCurrent(0);
        setProgress(0);
      }, 300);
    }
  }, [current, stories.length, onClose]);

  const goToPrev = useCallback(() => {
    if (current > 0) {
      setCurrent((c) => c - 1);
    } else {
      setProgress(0);
    }
  }, [current]);

  const handleDeleteStory = async () => {
    if (!stories[current]) return;

    setIsDeleting(true);
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from('live_stories')
        .delete()
        .eq('id', stories[current].id);

      if (error) {
        toast.error('Failed to delete story');
        return;
      }

      toast.success('Story deleted');

      const updatedStories = stories.filter((_, index) => index !== current);
      setStories(updatedStories);

      if (updatedStories.length === 0) {
        onClose();
        return;
      }

      if (current >= updatedStories.length) {
        setCurrent(updatedStories.length - 1);
      }

      setProgress(0);
    } catch {
      toast.error('Failed to delete story');
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    document.body.classList.add('story-viewer-open');
    return () => document.body.classList.remove('story-viewer-open');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !profileId) return;
    setLoading(true);
    setStories([]);
    setStoryProfile(null);
    setCurrent(0);
    setProgress(0);
    setPreloadedMedia(new Set());

    const supabase = createClient();

    Promise.all([
      supabase
        .from('live_stories')
        .select('*')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: true }),
      supabase
        .from('profiles')
        .select('username, full_name, avatar_url')
        .eq('id', profileId)
        .maybeSingle(),
    ]).then(([storiesResult, profileResult]) => {
      if (storiesResult.error) {
        toast.error('Failed to load stories');
        setLoading(false);
        return;
      }

      const storiesData = storiesResult.data || [];
      setStories(storiesData);
      if (profileResult.data) {
        setStoryProfile(profileResult.data);
      }
      setLoading(false);

      if (storiesData.length > 0) {
        preloadMedia(storiesData);
      }
    });
  }, [isOpen, profileId, preloadMedia]);

  const recordStoryView = useCallback(async (storyId: string) => {
    if (!profile?.id) return;

    try {
      const supabase = createClient();
      await supabase
        .from('user_story_views')
        .upsert({
          story_id: storyId,
          viewer_profile_id: profile.id,
          viewed_at: new Date().toISOString()
        }, {
          onConflict: 'story_id,viewer_profile_id'
        });
    } catch (error) {
      console.error('Failed to record story view:', error);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (!isOpen || stories.length === 0 || preloading || isDrawerOpen || isDeleteDialogOpen) return;
    setProgress(0);

    if (stories[current]) {
      recordStoryView(stories[current].id);
    }

    const currentDuration = getCurrentStoryDuration();

    if (progressRef.current) clearInterval(progressRef.current);
    const start = Date.now();
    progressRef.current = setInterval(() => {
      setProgress(Math.min(1, (Date.now() - start) / currentDuration));
    }, 100);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      goToNext();
    }, currentDuration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [isOpen, current, stories.length, preloading, isDrawerOpen, isDeleteDialogOpen, recordStoryView, getCurrentStoryDuration, goToNext]);

  useEffect(() => {
    if (!stories[current]) return;
    setRenderAsVideo(getStoryMediaKind(stories[current].media_url) === 'video');
  }, [current, stories]);

  useEffect(() => {
    if (!isOpen) {
      setStories([]);
      setStoryProfile(null);
      setCurrent(0);
      setProgress(0);
      setRenderAsVideo(false);
      setPreloadedMedia(new Set());
      setStoryDurations(new Map());
      setPreloading(false);
      setIsDragging(false);
      setDragOffset(0);
      setIsDrawerOpen(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
    }
  }, [isOpen]);

  const renderProgressBar = () => (
    <div className="absolute top-0 left-0 z-40 flex w-full gap-1 px-3 pt-3 pb-2">
      {stories.map((_, idx) => (
        <div
          key={idx}
          className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25"
        >
          <div
            className="h-full rounded-full transition-[width] duration-100 ease-linear"
            style={{
              width:
                idx < current
                  ? '100%'
                  : idx === current
                  ? `${Math.round(progress * 100)}%`
                  : '0%',
              background: 'var(--brand-grad)',
            }}
          />
        </div>
      ))}
    </div>
  );

  const renderStoryHeader = () => {
    if (loading || preloading || !stories.length) return null;

    const story = stories[current];
    const profileHref = storyProfile?.username ? `/u/${storyProfile.username}` : undefined;

    return (
      <div className="absolute top-0 left-0 right-0 z-40 bg-gradient-to-b from-black/70 via-black/35 to-transparent px-3 pb-10 pt-9">
        <div className="flex items-center gap-2.5">
          {profileHref ? (
            <Link
              href={profileHref}
              onClick={(e) => e.stopPropagation()}
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full py-1 pr-2 transition-opacity hover:opacity-90"
            >
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full p-[2px]"
                style={{ background: 'var(--brand-grad)' }}
              >
                <span className="block h-full w-full overflow-hidden rounded-full bg-black">
                  {storyProfile?.avatar_url ? (
                    <img
                      src={storyProfile.avatar_url}
                      alt={displayName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-muted text-xs font-semibold text-white">
                      {displayName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>
              </span>
              <span className="min-w-0 text-left">
                <span className="block truncate text-sm font-semibold text-white leading-tight">
                  {displayName}
                </span>
                <span className="block text-[11px] text-white/65">
                  {formatStoryTime(story.created_at)}
                </span>
              </span>
            </Link>
          ) : (
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full p-[2px]"
                style={{ background: 'var(--brand-grad)' }}
              >
                <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-black text-xs font-semibold text-white">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-white">{displayName}</span>
                <span className="block text-[11px] text-white/65">
                  {formatStoryTime(story.created_at)}
                </span>
              </span>
            </div>
          )}

          <div className="flex shrink-0 items-center gap-1">
            {isOwnStory && (
              <DropdownMenu open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full border border-white/15 bg-black/35 text-white backdrop-blur-sm hover:bg-black/50 hover:text-white"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal size={18} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDeleteDialogOpen(true);
                      setIsDrawerOpen(false);
                    }}
                  >
                    <Trash2 size={16} className="mr-2" />
                    Delete story
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full border border-white/15 bg-black/35 text-white backdrop-blur-sm hover:bg-black/50 hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              aria-label="Close story"
            >
              <X size={18} />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderStory = () => {
    if (loading) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-black">
          <div
            className="h-12 w-12 animate-spin rounded-full border-[3px] border-white/20 border-t-transparent"
            style={{ borderTopColor: 'var(--brand-pink)' }}
          />
          <p className="text-sm font-medium text-white/60">Loading story…</p>
        </div>
      );
    }

    if (preloading) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-black">
          <div
            className="h-12 w-12 animate-spin rounded-full border-[3px] border-white/20 border-t-transparent"
            style={{ borderTopColor: 'var(--brand-violet)' }}
          />
        </div>
      );
    }

    if (!stories.length) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-black px-8 text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-[var(--brand-on-accent)]"
            style={{ background: 'var(--brand-grad)', boxShadow: 'var(--brand-ring-money)' }}
          >
            <ChevronLeft size={24} className="rotate-180" />
          </div>
          <div>
            <p className="text-base font-semibold text-white">No stories right now</p>
            <p className="mt-1 text-sm text-white/55">Check back later for new updates.</p>
          </div>
          <Button
            variant="outline"
            className="mt-2 rounded-full border-white/20 bg-white/10 px-5 text-white hover:bg-white/20 hover:text-white"
            onClick={onClose}
          >
            Go back
          </Button>
        </div>
      );
    }

    const story = stories[current];
    const overlays = Array.isArray(story.overlays) ? story.overlays : [];

    return (
      <div className="relative h-full w-full">
        {!renderAsVideo ? (
          <img
            src={story.media_url}
            alt="Story"
            className="h-full w-full object-cover"
            onError={() => setRenderAsVideo(true)}
          />
        ) : (
          <video
            ref={videoElRef}
            src={story.media_url}
            className="h-full w-full object-cover"
            autoPlay
            playsInline
            controls={false}
            muted={false}
          />
        )}
        {overlays.map((overlay: any) => (
          <div
            key={overlay.id}
            style={{
              position: 'absolute',
              left: `${overlay.x * 100}%`,
              top: `${overlay.y * 100}%`,
              transform: `translate(-50%, -50%) rotate(${overlay.rotation || 0}deg) scale(${overlay.scale || 1})`,
              zIndex: 10,
              pointerEvents: 'none',
              userSelect: 'none',
              minWidth: 40,
              minHeight: 30,
              maxWidth: '80%',
              color: '#fff',
              fontWeight: 600,
              fontSize: 28 * (overlay.scale || 1),
              padding: '2px 8px',
              borderRadius: 8,
              whiteSpace: 'pre-line',
            }}
          >
            {overlay.text}
          </div>
        ))}
        {/* Tap zones: left = prev, right = next */}
        <div className="absolute inset-0 z-20 flex">
          <button
            type="button"
            className="h-full w-[35%] cursor-pointer bg-transparent"
            onClick={(e) => {
              e.stopPropagation();
              goToPrev();
            }}
            aria-label="Previous story"
          />
          <button
            type="button"
            className="h-full w-[65%] cursor-pointer bg-transparent"
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            aria-label="Next story"
          />
        </div>

        {/* Bottom vignette */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-t from-black/50 to-transparent" />
      </div>
    );
  };

  useEffect(() => {
    if (!isOpen || !stories.length || preloading) return;
    const story = stories[current];
    if (renderAsVideo && videoElRef.current) {
      const playPromise = videoElRef.current.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.catch(() => {});
      }
    }
  }, [isOpen, current, stories.length, preloading, renderAsVideo]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          ref={dialogRef}
          hideCloseButton
          className={cn(
            'story-viewer-content',
            'fixed z-50 grid max-w-none gap-0 overflow-hidden rounded-none border-0 bg-black p-0 shadow-none',
            '!top-0 !left-0 !translate-x-0 !translate-y-0',
            'h-full w-full',
            'md:!top-1/2 md:!left-1/2 md:!-translate-x-1/2 md:!-translate-y-1/2',
            'md:h-auto md:w-auto md:max-h-[90vh] md:rounded-2xl',
            'transition-[transform,opacity] duration-200 ease-out',
            '[box-shadow:var(--brand-ring-money)]'
          )}
          style={{
            aspectRatio: '9/16',
            height: '100dvh',
            width: '100vw',
            maxHeight: '100dvh',
            ...(isDragging
              ? { transform: `translateY(${dragOffset}px)`, opacity: Math.max(0.3, 1 - dragOffset / 300) }
              : {}),
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <style>{`
            body.story-viewer-open [data-slot="dialog-overlay"] {
              background: rgb(0 0 0 / 0.78) !important;
              backdrop-filter: blur(10px);
              -webkit-backdrop-filter: blur(10px);
            }
            @media (min-width: 768px) {
              .story-viewer-content {
                height: min(90vh, calc(90vw * 16 / 9)) !important;
                width: auto !important;
                max-width: min(420px, 100vw - 2rem) !important;
              }
            }
            @media (max-width: 767px) {
              .story-viewer-content {
                height: calc(100dvh - 4rem) !important;
                max-height: calc(100dvh - 4rem) !important;
                margin-top: 0 !important;
                top: 0 !important;
              }
            }
          `}</style>

          <DialogHeader className="sr-only">
            <DialogTitle>{displayName}&apos;s story</DialogTitle>
            <DialogDescription>Viewing stories from {displayName}</DialogDescription>
          </DialogHeader>

          {!loading && !preloading && stories.length > 0 && renderProgressBar()}
          {renderStoryHeader()}

          <div className="relative flex h-full w-full items-center justify-center overflow-hidden md:rounded-2xl">
            {renderStory()}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="gap-0 overflow-hidden rounded-2xl border-border/80 p-0 sm:max-w-[380px] [box-shadow:var(--brand-ring-money)]">
          <div className="px-6 pt-6 pb-4" style={{ background: 'var(--brand-grad-soft)' }}>
            <AlertDialogHeader className="space-y-1.5 p-0 text-left">
              <AlertDialogTitle className="text-lg font-semibold tracking-tight">
                Delete story?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm leading-relaxed text-muted-foreground">
                This story will be removed immediately. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>
          <AlertDialogFooter className="gap-2 border-t border-border/60 bg-muted/20 px-6 py-4 sm:justify-end">
            <AlertDialogCancel className="h-10 rounded-full px-5">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStory}
              disabled={isDeleting}
              className="h-10 rounded-full bg-destructive px-5 text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
