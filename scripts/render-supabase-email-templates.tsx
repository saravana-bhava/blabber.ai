/**
 * Renders branded HTML email templates.
 *
 * Usage: npm run email:export-templates
 * Output:
 *   supabase/templates/*.html  — committed, deployed by CI to Supabase Auth
 *   src/emails/generated/*.html — gitignored, for local preview
 */
import { render } from '@react-email/render';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { ReactElement } from 'react';
import SupabaseChangeEmail from '@/emails/supabase-change-email';
import SupabaseConfirmSignup from '@/emails/supabase-confirm-signup';
import SupabaseMagicLink from '@/emails/supabase-magic-link';
import SupabaseResetPassword from '@/emails/supabase-reset-password';

async function main() {
  const previewDir = join(process.cwd(), 'src/emails/generated');
  const templatesDir = join(process.cwd(), 'supabase/templates');
  mkdirSync(previewDir, { recursive: true });
  mkdirSync(templatesDir, { recursive: true });

  const templates: { supabaseFile: string; previewFile: string; node: ReactElement }[] = [
    { supabaseFile: 'confirmation.html',   previewFile: 'confirm-signup.html',  node: SupabaseConfirmSignup() },
    { supabaseFile: 'reset-password.html', previewFile: 'reset-password.html',  node: SupabaseResetPassword() },
    { supabaseFile: 'magic-link.html',     previewFile: 'magic-link.html',      node: SupabaseMagicLink() },
    { supabaseFile: 'change-email.html',   previewFile: 'change-email.html',    node: SupabaseChangeEmail() },
  ];

  for (const { supabaseFile, previewFile, node } of templates) {
    const html = await render(node, { pretty: true });
    writeFileSync(join(templatesDir, supabaseFile), html, 'utf8');
    writeFileSync(join(previewDir, previewFile), html, 'utf8');
  }

}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
