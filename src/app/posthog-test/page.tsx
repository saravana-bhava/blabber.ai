'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { capturePostHogEvent, optInPostHog } from '@/lib/posthog/client';

export default function PostHogTestPage() {
  const [lastEventId, setLastEventId] = useState<string | null>(null);
  const [lastStatus, setLastStatus] = useState<string | null>(null);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-6 text-foreground">
      <section className="w-full max-w-md space-y-5 text-center">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-pink-500">
            PostHog test
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Send a client event.
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Use PostHog Live events or Debugger to confirm the event arrives.
          </p>
        </div>
        <Button
          className="bg-pink-500 text-white hover:bg-pink-600"
          onClick={async () => {
            optInPostHog();
            const eventId = crypto.randomUUID();
            const result = await capturePostHogEvent('posthog_test_event', {
              test_event_id: eventId,
              source: 'posthog-test-page',
            });
            setLastEventId(eventId);
            setLastStatus(JSON.stringify(result));
          }}
        >
          Send PostHog Event
        </Button>
        {lastEventId ? (
          <p className="break-all text-xs text-muted-foreground">
            Last event: {lastEventId}
            <br />
            Result: {lastStatus}
          </p>
        ) : null}
      </section>
    </main>
  );
}
