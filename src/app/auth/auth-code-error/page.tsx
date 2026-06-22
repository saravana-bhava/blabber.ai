'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';
import { safeNextPath } from '@/lib/auth/post-auth-bootstrap';

async function bootstrapAfterSession() {
  await fetch('/api/auth/bootstrap-session', {
    method: 'POST',
    credentials: 'include',
  });
}

/** If Supabase redirects here with `#access_token=…` after a mistaken server-side failure, rescue the session client-side. */
function HashRescueGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tried = useRef(false);
  const [rescuing, setRescuing] = useState(() => typeof window !== 'undefined' && window.location.hash?.includes('access_token'));

  useEffect(() => {
    if (tried.current) return;
    if (typeof window === 'undefined' || !window.location.hash?.includes('access_token')) {
      tried.current = true;
      return;
    }

    tried.current = true;

    void (async () => {
      setRescuing(true);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const access_token = hashParams.get('access_token');
      const refresh_token = hashParams.get('refresh_token');
      if (!access_token || !refresh_token) {
        setRescuing(false);
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });

      window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`);

      if (error) {
        console.error('auth-code-error: hash rescue failed', error.message);
        setRescuing(false);
        return;
      }

      await bootstrapAfterSession();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      const nextRaw =
        searchParams.get('next') ??
        (user?.user_metadata?.is_agency_operated === true ? '/creator-dashboard' : '/home');
      window.location.assign(safeNextPath(nextRaw));
    })();
  }, [router, searchParams]);

  if (rescuing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-100 p-4 text-muted-foreground">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        <p className="text-sm">Recovering session…</p>
      </div>
    );
  }

  return <>{children}</>;
}

export default function AuthCodeErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
          <p className="text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <HashRescueGate>
        <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
          <Card className="w-full max-w-md text-center">
            <CardHeader>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <CardTitle className="text-xl font-semibold">Authentication Error</CardTitle>
              <CardDescription>
                Something went wrong while trying to sign you in.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Please try signing in again. If the issue persists, ensure you have confirmed your email address or contact support.
              </p>
              <Button asChild className="w-full">
                <Link href="/login">Go to sign in</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </HashRescueGate>
    </Suspense>
  );
}
