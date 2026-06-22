'use client';

import { useEffect, useState } from 'react';
import { LazyMuxFeedPlayer } from './lazy-mux-feed-player';

interface PpvLiveStreamPlayerProps {
  postId: string;
  playbackId: string;
  streamType: 'live' | 'on-demand';
  aspectRatioPercent: number;
  metadata: { video_title: string; video_id: string };
  overlay?: React.ReactNode;
}

/**
 * Fetches a short-lived Mux signed playback token for PPV live streams,
 * then renders the player. The token is obtained server-side after
 * verifying the user has paid — preventing HLS URL leakage.
 */
export function PpvLiveStreamPlayer({
  postId,
  playbackId,
  streamType,
  aspectRatioPercent,
  metadata,
  overlay,
}: PpvLiveStreamPlayerProps) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/mux-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.token) setToken(data.token);
        else setError(true);
      })
      .catch(() => setError(true));
  }, [postId]);

  if (error) {
    return (
      <div className="flex items-center justify-center rounded-lg bg-black/80 p-6 text-sm text-white/60">
        Could not load stream. Please refresh and try again.
      </div>
    );
  }

  if (!token) {
    return (
      <div
        className="relative w-full rounded-lg bg-black"
        style={{ paddingBottom: `${aspectRatioPercent}%` }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
        </div>
      </div>
    );
  }

  return (
    <LazyMuxFeedPlayer
      playbackId={playbackId}
      playbackToken={token}
      streamType={streamType}
      aspectRatioPercent={aspectRatioPercent}
      autoPlayWhenInView={streamType === 'live'}
      metadata={metadata}
      overlay={overlay}
    />
  );
}
