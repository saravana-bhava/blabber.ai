/**
 * Supabase replaces `{{ .SiteURL }}` when sending; use for <Img src> in pasted HTML.
 * Logo file: public/logo.png → served at /logo.png.
 */
export const SUPABASE_LOGO_IMG_SRC = '{{ .SiteURL }}/logo.png' as const;

export function absoluteLogoUrl(siteOrigin?: string | null): string {
  const trimmed = siteOrigin?.trim();
  const base = trimmed ? trimmed.replace(/\/+$/, '') : '';
  if (base) {
    return `${base}/logo.png`;
  }
  const fallback = (
    process.env.EMAIL_PREVIEW_ORIGIN ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://localhost:3000'
  ).replace(/\/+$/, '');
  return `${fallback}/logo.png`;
}
