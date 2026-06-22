'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import MuxPlayer from '@mux/mux-player-react/lazy';
import { RemoteImage } from '@/components/ui/remote-image';
import { usePostFullAccess } from '@/lib/feed/use-post-full-access';
import { publicPostImageUrl } from '@/lib/feed/post-access';
import { muxThumbnailUrl } from '@/lib/mux/thumbnail';
import { cn } from '@/lib/utils';
import type { Post } from '@/lib/types';

const MUX_GRID_STYLE = {
  '--media-controls-display': 'none',
  '--media-controls-background': 'transparent',
  '--controls': 'none',
  '--fullscreen-button': 'none',
  '--media-object-fit': 'cover',
  '--media-object-position': 'center',
  '--media-background-color': 'transparent',
} as React.CSSProperties;

type ShortGridPreviewProps = {
  post: Post;
  className?: string;
  priority?: boolean;
  sizes?: string;
};

export function ShortGridPreview({
  post,
  className,
  priority = false,
  sizes = '33vw',
}: ShortGridPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);
  const { hasFullAccess } = usePostFullAccess(post);

  const videoMedia =
    post.post_media?.find((media) => media.media_type === 'short') ?? post.post_media?.[0];
  const playbackId = videoMedia?.mux_playback_id ?? null;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { threshold: 0.35, rootMargin: '0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const posterUrl = playbackId
    ? muxThumbnailUrl(playbackId, { time: 0, width: 400 })
    : videoMedia?.storage_path
      ? videoMedia.storage_path.startsWith('http')
        ? videoMedia.storage_path
        : publicPostImageUrl(videoMedia.storage_path)
      : null;

  const blurredUrl = videoMedia?.blurred_storage_path
    ? publicPostImageUrl(videoMedia.blurred_storage_path)
    : null;

  const shouldPlay = hasFullAccess && !!playbackId && isInView;

  return (
    <div ref={containerRef} className={cn('absolute inset-0 overflow-hidden', className)}>
      {!hasFullAccess && blurredUrl ? (
        <RemoteImage src={blurredUrl} alt="" fill className="object-cover" sizes={sizes} />
      ) : posterUrl ? (
        <Image
          src={posterUrl}
          alt=""
          fill
          className={cn('object-cover', shouldPlay && 'opacity-0')}
          sizes={sizes}
          priority={priority}
        />
      ) : null}

      {shouldPlay && (
        <MuxPlayer
          loading="viewport"
          playbackId={playbackId}
          streamType="on-demand"
          preferPlayback="mse"
          className="pointer-events-none absolute inset-0 h-full w-full min-h-full min-w-full"
          autoPlay
          muted
          loop
          playsInline
          theme="minimal"
          style={MUX_GRID_STYLE}
          metadata={{
            video_title: 'Short preview',
            video_id: playbackId,
          }}
        />
      )}
    </div>
  );
}
