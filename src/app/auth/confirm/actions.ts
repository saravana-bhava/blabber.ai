'use server';

import { cookies } from 'next/headers';
import type { EmailOtpType } from '@supabase/supabase-js';
import { bootstrapAuthUserResources } from '@/lib/auth/post-auth-bootstrap';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

const ALLOWED_TYPES: readonly EmailOtpType[] = [
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
];

export type AuthConfirmResult = { ok: true } | { ok: false; error: string };

/**
 * Verify email OTP server-side so session cookies are set before redirecting to /home.
 * referralCode is read client-side and passed explicitly to survive localhost/127.0.0.1 domain split.
 */
export async function verifyEmailFromOtp(
  token_hash: string,
  type: EmailOtpType,
  referralCode?: string | null
): Promise<AuthConfirmResult> {
  if (!token_hash?.trim()) {
    return { ok: false, error: 'Missing token' };
  }
  if (!ALLOWED_TYPES.includes(type)) {
    return { ok: false, error: 'Invalid verification type' };
  }

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (error) {
      return { ok: false, error: error.message };
    }

    const user =
      data.user ?? (await supabase.auth.getUser()).data.user ?? null;
    if (!user) {
      return { ok: false, error: 'No user after verification' };
    }

    // Use explicitly passed code; fall back to cookie (same-domain calls only)
    const refCode = referralCode || cookieStore.get('blabber_ref')?.value || null;

    const admin = createServiceRoleClient();
    const { referralClaimed } = await bootstrapAuthUserResources(supabase, admin, user, refCode);
    if (referralClaimed) {
      cookieStore.delete('blabber_ref');
    }

    return { ok: true };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Verification failed';
    console.error('verifyEmailFromOtp:', e);
    return { ok: false, error: message };
  }
}

/** PKCE email links (default Supabase template) land with ?code= after /auth/v1/verify. */
export async function exchangeAuthCodeFromEmail(
  code: string,
  referralCode?: string | null
): Promise<AuthConfirmResult> {
  if (!code?.trim()) {
    return { ok: false, error: 'Missing code' };
  }

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return { ok: false, error: error.message };
    }

    const user =
      data.user ?? (await supabase.auth.getUser()).data.user ?? null;
    if (!user) {
      return { ok: false, error: 'No user after code exchange' };
    }

    const refCode = referralCode || cookieStore.get('blabber_ref')?.value || null;

    const admin = createServiceRoleClient();
    const { referralClaimed } = await bootstrapAuthUserResources(supabase, admin, user, refCode);
    if (referralClaimed) {
      cookieStore.delete('blabber_ref');
    }

    return { ok: true };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Code exchange failed';
    console.error('exchangeAuthCodeFromEmail:', e);
    return { ok: false, error: message };
  }
}
