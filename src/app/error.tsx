'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-6 text-foreground">
      <section className="w-full max-w-md space-y-5 text-center">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-pink-500">
            Something went wrong
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Blabber hit an unexpected error.
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            The issue has been reported. Try again, and we will pick up right where you left off.
          </p>
        </div>
        <Button onClick={reset} className="bg-pink-500 text-white hover:bg-pink-600">
          Try again
        </Button>
      </section>
    </main>
  );
}
