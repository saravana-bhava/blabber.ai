import { render } from '@react-email/render';
import { Resend } from 'resend';
import type { ReactElement } from 'react';

let client: Resend | null = null;

export function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

/**
 * "Name <email@domain.com>". Use a verified domain in Resend (e.g. noreply@blabber.ai).
 * Default uses Resend's sandbox sender for local dev only.
 *
 * Trims whitespace and strips a single pair of wrapping quotes (single or
 * double) — some shells/`.env` setups end up persisting RESEND_FROM with
 * literal quotes around the value, which Resend rejects with "Invalid `from`
 * field" because the parser sees `"Name <addr>"` instead of `Name <addr>`.
 */
export function getResendFromAddress(): string {
  const raw = (process.env.RESEND_FROM ?? 'Blabber <onboarding@resend.dev>').trim();
  if (raw.length >= 2) {
    const first = raw[0];
    const last = raw[raw.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return raw.slice(1, -1).trim();
    }
  }
  return raw;
}

export async function sendResendReactEmail(options: {
  to: string | string[];
  subject: string;
  react: ReactElement;
  replyTo?: string;
}): Promise<{ ok: true; id: string | undefined } | { ok: false; error: string }> {
  const resend = getResend();
  if (!resend) {
    return { ok: false, error: 'RESEND_API_KEY is not configured' };
  }

  const html = await render(options.react);

  const { data, error } = await resend.emails.send({
    from: getResendFromAddress(),
    to: options.to,
    subject: options.subject,
    html,
    ...(options.replyTo ? { replyTo: options.replyTo } : {}),
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, id: data?.id };
}
