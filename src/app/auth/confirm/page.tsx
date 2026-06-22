'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { safeNextPath } from '@/lib/auth/post-auth-bootstrap';
import { waitForClientSession } from '@/lib/auth/wait-for-session';
import {
  exchangeAuthCodeFromEmail,
  verifyEmailFromOtp,
} from '@/app/auth/confirm/actions';

const ALLOWED_TYPES: readonly EmailOtpType[] = [
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
];

async function bootstrapAfterSession(): Promise<boolean> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch('/api/auth/bootstrap-session', {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) return true;
    await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
  }
  return false;
}

/** Full navigation so the next page load includes auth cookies. */
function redirectAuthenticated(nextPath: string) {
  window.location.assign(safeNextPath(nextPath));
}

function AuthConfirmInner() {
  const searchParams = useSearchParams();
  const ran = useRef(false);
  const [message, setMessage] = useState('Completing sign-in…');

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    void (async () => {
      try {
        const qs =
          typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search)
            : searchParams;

        const nextRaw = qs.get('next') ?? searchParams.get('next') ?? '/home';
        const nextPath = safeNextPath(nextRaw);

        // Referral code: try URL param first (survives localhost/127.0.0.1 domain split),
        // then fall back to reading document.cookie directly.
        const refFromUrl = qs.get('ref') ?? null;
        const refFromCookie = typeof document !== 'undefined'
          ? (document.cookie.split('; ').find((c) => c.startsWith('blabber_ref='))?.split('=')[1] ?? null)
          : null;
        const refCode = refFromUrl ?? refFromCookie;

        const code = qs.get('code');
        if (code) {
          setMessage('Verifying your email…');
          const result = await exchangeAuthCodeFromEmail(code, refCode);
          if (!result.ok) {
            console.error('auth/confirm: code exchange failed', result.error);
            redirectAuthenticated('/auth/auth-code-error');
            return;
          }
          redirectAuthenticated(nextPath);
          return;
        }

        const token_hash = qs.get('token_hash');
        const typeParam = qs.get('type');
        if (token_hash && typeParam && ALLOWED_TYPES.includes(typeParam as EmailOtpType)) {
          setMessage('Verifying your email…');
          const result = await verifyEmailFromOtp(token_hash, typeParam as EmailOtpType, refCode);
          if (!result.ok) {
            console.error('auth/confirm: verifyOtp failed', result.error);
            redirectAuthenticated('/auth/auth-code-error');
            return;
          }
          redirectAuthenticated(nextPath);
          return;
        }

        const supabase = createClient();

        if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
          setMessage('Signing you in…');
          const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
          const access_token = hashParams.get('access_token');
          const refresh_token = hashParams.get('refresh_token');

          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) {
              console.error('auth/confirm: setSession failed', error.message);
              redirectAuthenticated('/auth/auth-code-error');
              return;
            }

            window.history.replaceState(
              {},
              '',
              `${window.location.pathname}${window.location.search}`
            );

            const hasSession = await waitForClientSession(supabase);
            if (!hasSession) {
              console.error('auth/confirm: session not available after setSession');
              redirectAuthenticated('/auth/auth-code-error');
              return;
            }

            await bootstrapAfterSession();
            redirectAuthenticated(nextPath);
            return;
          }
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          await bootstrapAfterSession();
          redirectAuthenticated(nextPath);
          return;
        }

        console.error('auth/confirm: unrecognized confirmation URL', {
          has_code: !!code,
          has_token_hash: !!token_hash,
          has_hash: typeof window !== 'undefined' && window.location.hash.includes('access_token'),
        });
        redirectAuthenticated('/auth/auth-code-error');
      } catch (e) {
        console.error('auth/confirm error', e);
        setMessage('Something went wrong.');
        redirectAuthenticated('/auth/auth-code-error');
      }
    })();
  }, [searchParams]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-muted-foreground">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

export default function AuthConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          <p className="text-sm">Loading…</p>
        </div>
      }
    >
      <AuthConfirmInner />
    </Suspense>
  );
}
