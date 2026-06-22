/** Hosts that should not use `/_next/image` (server fetch often fails or is unnecessary). */
const BYPASS_OPTIMIZATION_HOSTS =
  /^(picsum\.photos|i\.pravatar\.cc|placehold\.co|images\.unsplash\.com)$/i;

const SUPABASE_STORAGE_HOSTS =
  /^(.*\.supabase\.co|data\.blabber\.ai|127\.0\.0\.1)$/i;

/**
 * When true, render with `<Image unoptimized />` so the browser loads the URL directly.
 * Avoids 500s from `/_next/image` when the Next server cannot reach picsum / placeholders (ETIMEDOUT).
 */
export function shouldBypassNextImageOptimization(src: string | null | undefined): boolean {
  if (!src) return false;
  if (!src.startsWith('http://') && !src.startsWith('https://')) return false;

  try {
    const { hostname } = new URL(src);
    if (BYPASS_OPTIMIZATION_HOSTS.test(hostname)) return true;
    if (SUPABASE_STORAGE_HOSTS.test(hostname)) return true;
  } catch {
    return false;
  }

  return false;
}
