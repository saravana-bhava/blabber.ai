'use client';

import { HomeFeedLayout } from '@/components/feed/home-feed-layout';
import { ShortsTab } from '@/components/feed/shorts-tab';
import { RequireAuth } from '@/components/auth/require-auth';

export default function ShortsPage() {
  return (
    <RequireAuth>
      <HomeFeedLayout searchPlaceholder="Search creators">
        <ShortsTab />
      </HomeFeedLayout>
    </RequireAuth>
  );
}
