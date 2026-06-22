/** Paths that do not require an authenticated session. */
const PUBLIC_EXACT = new Set([
  '/',
  '/login',
  '/manifest.json',
  '/robots.txt',
  '/sitemap.xml',
  '/signup',
  '/pricing',
  '/terms-of-service',
  '/privacy-policy',
  '/refund-policy',
  '/content-removal',
  '/custodian-of-records',
  '/epoch-callback',
  '/ingest',
  '/onyx-callback',
  '/monitoring-tunnel',
  '/posthog-test',
  '/sentry-example-page',
]);

const PUBLIC_PREFIXES = ['/auth/', '/ingest/', '/p/', '/u/', '/og', '/ref/'];

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
