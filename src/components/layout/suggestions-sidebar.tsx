'use client';

import Link from 'next/link';
import { SuggestedForYou, SuggestedForYouSkeleton } from '@/components/layout/suggested-for-you';

export function SuggestionsSidebar() {
  return (
    <aside className="app-rail hidden h-full max-h-full w-[var(--app-rail-width)] shrink-0 flex-col gap-4 overflow-hidden border-l border-border bg-background p-3 lg:flex">
      <SuggestedForYou />

      <div className="shrink-0 px-2 pt-1 text-muted-foreground">
        <p className="text-[11.5px] leading-relaxed text-muted-foreground">
          <Link href="/privacy-policy" className="hover:underline">
            Privacy
          </Link>
          {' · '}
          <Link href="/terms-of-service" className="hover:underline">
            Terms
          </Link>
          {' · '}
          <Link href="/help-center" className="hover:underline">
            Help
          </Link>
          {' · '}
          <span>© 2026 Blabber</span>
        </p>
      </div>
    </aside>
  );
}

export function SuggestionsSidebarSkeleton() {
  return (
    <aside className="app-rail hidden h-full max-h-full w-[var(--app-rail-width)] shrink-0 flex-col gap-4 overflow-hidden border-l border-border bg-background p-3 lg:flex">
      <SuggestedForYouSkeleton />
    </aside>
  );
}
