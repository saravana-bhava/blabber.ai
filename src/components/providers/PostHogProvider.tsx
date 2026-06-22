'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { capturePostHogEvent, initPostHog, isPostHogConfigured } from '@/lib/posthog/client';

let initialized = false;

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!initialized || !pathname) return;

    const query = searchParams.toString();
    void capturePostHogEvent('$pageview', {
      $current_url: `${window.location.origin}${pathname}${query ? `?${query}` : ''}`,
    });
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (initialized || !isPostHogConfigured()) return;

    initPostHog();
    initialized = true;
  }, []);

  return (
    <>
      {children}
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
    </>
  );
}
