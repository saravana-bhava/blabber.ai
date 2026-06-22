/** Detect whether a story URL points at image or video media. */
export function getStoryMediaKind(url: string): 'image' | 'video' {
  if (!url) return 'image';

  const path = url.split('?')[0].split('#')[0].toLowerCase();

  if (/\.(mp4|webm|mov|ogg|m4v)(\?|#|$)/i.test(path)) {
    return 'video';
  }

  if (/\.(jpe?g|png|gif|webp|avif|heic|heif|bmp|svg)(\?|#|$)/i.test(path)) {
    return 'image';
  }

  // Common image CDNs that omit file extensions in the URL path
  if (
    /picsum\.photos|placehold\.co|images\.unsplash|i\.imgur\.com\/(?!.*\.mp4)/i.test(url)
  ) {
    return 'image';
  }

  // Extension-less Supabase story uploads are rare; default unknown URLs to image
  // (img onError can fall back to video in the viewer).
  return 'image';
}

export function isStoryVideoUrl(url: string): boolean {
  return getStoryMediaKind(url) === 'video';
}

export function isStoryImageUrl(url: string): boolean {
  return getStoryMediaKind(url) === 'image';
}
