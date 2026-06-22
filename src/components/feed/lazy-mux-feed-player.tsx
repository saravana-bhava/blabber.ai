'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import MuxPlayer from '@mux/mux-player-react/lazy';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { muxThumbnailUrl } from '@/lib/mux/thumbnail';

const MUX_PLAYER_CHROME_HIDDEN = {
  '--media-controls-display': 'none',
  '--media-controls-background': 'transparent',
  '--media-controls-padding': '0',
  '--media-controls-margin': '0',
  '--media-controls-opacity': '0',
  '--media-controls-visibility': 'hidden',
  '--fullscreen-button': 'none',
  '--controls': 'none',
} as React.CSSProperties;

type LazyMuxFeedPlayerProps = {
  playbackId: string;
  /** Signed JWT for Mux signed-playback-policy streams (PPV). */
  playbackToken?: string;
  streamType?: 'on-demand' | 'live';
  className?: string;
  /** CSS padding-bottom % for aspect ratio box (e.g. "56.25") */
  aspectRatioPercent?: number;
  metadata?: { video_title?: string; video_id?: string };
  onLoadedData?: (e: Event) => void;
  /** Live streams: mount + muted autoplay when scrolled into view */
  autoPlayWhenInView?: boolean;
  overlay?: React.ReactNode;
};

/**
 * Viewport-gated Mux playback for the home feed.
 * Shows a static poster until the post is near the viewport; loads HLS only after tap
 * (or muted autoplay for live when autoPlayWhenInView is set).
 */
export function LazyMuxFeedPlayer({
  playbackId,
  playbackToken,
  streamType = 'on-demand',
  className,
  aspectRatioPercent = 56.25,
  metadata,
  onLoadedData,
  autoPlayWhenInView = false,
  overlay,
}: LazyMuxFeedPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const [userRequestedPlay, setUserRequestedPlay] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible =
          entry.isIntersecting &&
          entry.intersectionRatio >= 0.15;
        setIsNearViewport(visible);
      },
      { rootMargin: '80px 0px', threshold: [0, 0.15, 0.35] }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isNearViewport) {
      setUserRequestedPlay(false);
    }
  }, [isNearViewport]);

  const shouldAutoplay = autoPlayWhenInView && isNearViewport;
  const shouldMountPlayer =
    isNearViewport && (userRequestedPlay || shouldAutoplay);
  const isPlaying = userRequestedPlay || shouldAutoplay;

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setUserRequestedPlay(true);
  };

  const posterUrl = muxThumbnailUrl(playbackId);

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full bg-black', className)}
      style={{ paddingBottom: `${aspectRatioPercent}%` }}
    >
      <div className="absolute inset-0">
        {!shouldMountPlayer && (
          <>
            <Image
              src={posterUrl}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              unoptimized
            />
            {!autoPlayWhenInView && (
              <button
                type="button"
                aria-label="Play video"
                onClick={handlePlayClick}
                className="absolute inset-0 z-[2] flex items-center justify-center bg-black/20 transition-colors hover:bg-black/30"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/30 bg-black/45 text-white backdrop-blur-sm">
                  <Play className="ml-0.5 h-7 w-7 fill-white" strokeWidth={0} />
                </span>
              </button>
            )}
          </>
        )}

        {shouldMountPlayer && (
          <MuxPlayer
            loading="viewport"
            playbackId={playbackId}
            tokens={playbackToken ? { playback: playbackToken } : undefined}
            preferPlayback="mse"
            streamType={streamType}
            className="h-full w-full"
            autoPlay={isPlaying}
            paused={!isPlaying}
            muted={shouldAutoplay}
            preload="none"
            playsInline
            metadata={metadata}
            theme="minimal"
            style={MUX_PLAYER_CHROME_HIDDEN}
            onLoadedData={onLoadedData}
          />
        )}

        {overlay}
      </div>
    </div>
  );
}
