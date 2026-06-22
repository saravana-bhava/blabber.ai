/**
 * Supabase templates use `<Img src="{{ .SiteURL }}/logo.png" />` for pasting into the dashboard.
 * That value is not a valid fetchable URL, so React Email's dev preview cannot show the image
 * until we substitute a real origin.
 *
 * - Preview / `email dev`: use EMAIL_PREVIEW_ORIGIN, then NEXT_PUBLIC_SITE_URL, then localhost:3000.
 * - `EMAIL_EXPORT_MODE=1` (see npm run email:export-templates): keep the Go placeholder verbatim.
 */
export function resolveEmailLogoImgSrc(logoSrc: string): string {
  if (process.env.EMAIL_EXPORT_MODE === '1') {
    return logoSrc;
  }

  const isSupabasePlaceholder =
    logoSrc.includes('{{ .SiteURL }}') || logoSrc.includes('{{.SiteURL}}');

  if (isSupabasePlaceholder) {
    const origin = (
      process.env.EMAIL_PREVIEW_ORIGIN ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      'http://localhost:3000'
    ).replace(/\/+$/, '');
    return `${origin}/logo.png`;
  }

  return logoSrc;
}
