import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Fan / user intro — BLABBER HOW TO */
export const USER_WALKTHROUGH_VIDEO_URL = 'https://vimeo.com/1198183937';

/** Creator monetization walkthrough — HOW TO CREATOR */
export const CREATOR_WALKTHROUGH_VIDEO_URL = 'https://vimeo.com/1198195931';

/** Minimal chrome — see https://help.vimeo.com/hc/en-us/articles/12426260232977 */
const VIMEO_MINIMAL_PARAMS: Record<string, string> = {
  title: '0',
  byline: '0',
  portrait: '0',
  badge: '0',
  vimeo_logo: '0',
  pip: '0',
  chromecast: '0',
  airplay: '0',
  quality_selector: '0',
  transcript: '0',
  cc: '0',
  chapters: '0',
  speed: '0',
  ask_ai: '0',
  dnt: '1',
};

function applyVimeoPlayerParams(embedUrl: string): string {
  try {
    const parsed = new URL(embedUrl);
    if (!parsed.hostname.includes('player.vimeo.com')) return embedUrl;
    for (const [key, value] of Object.entries(VIMEO_MINIMAL_PARAMS)) {
      parsed.searchParams.set(key, value);
    }
    return parsed.toString();
  } catch {
    return embedUrl;
  }
}

export function toWalkthroughEmbedUrl(raw: string): string {
  const url = raw.trim();
  if (!url) return '';

  if (url.includes('player.vimeo.com/video/')) {
    return applyVimeoPlayerParams(url);
  }

  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) {
    return applyVimeoPlayerParams(`https://player.vimeo.com/video/${vimeo[1]}`);
  }

  if (url.includes('youtube.com/embed/') || url.includes('youtu.be/embed/')) {
    return url;
  }

  const ytWatch = url.match(
    /(?:youtube\.com\/watch\?v=|youtube\.com\/watch\?.*&v=)([\w-]{11})/
  );
  if (ytWatch) return `https://www.youtube.com/embed/${ytWatch[1]}`;

  const ytShort = url.match(/youtu\.be\/([\w-]{11})/);
  if (ytShort) return `https://www.youtube.com/embed/${ytShort[1]}`;

  return url;
}

type WalkthroughVideoProps = {
  src?: string;
  title?: string;
  className?: string;
};

export function WalkthroughVideo({
  src = USER_WALKTHROUGH_VIDEO_URL,
  title = 'How to use Blabber',
  className,
}: WalkthroughVideoProps) {
  const embedUrl = toWalkthroughEmbedUrl(src);

  if (!embedUrl) {
    return (
      <div
        className={cn(
          'aspect-video w-full rounded-lg bg-muted flex flex-col items-center justify-center gap-3 text-muted-foreground border border-dashed',
          className
        )}
        aria-label="Video placeholder"
      >
        <Play className="h-14 w-14 opacity-60" />
        <p className="text-sm font-medium">Video coming soon</p>
      </div>
    );
  }

  if (/\.(mp4|webm|ogg)(\?|$)/i.test(embedUrl)) {
    return (
      <video
        className={cn('aspect-video w-full rounded-lg bg-black', className)}
        src={embedUrl}
        controls
        playsInline
        preload="metadata"
      />
    );
  }

  return (
    <div
      className={cn(
        'aspect-video w-full overflow-hidden rounded-lg bg-black',
        className
      )}
    >
      <iframe
        src={embedUrl}
        title={title}
        className="h-full w-full border-0"
        allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media"
        allowFullScreen
      />
    </div>
  );
}
