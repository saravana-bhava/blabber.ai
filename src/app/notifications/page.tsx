'use client';

import { PageShell } from '@/components/layout/page-header';
import { useUser } from '@/lib/contexts/user-context';
import { RequireAuth } from '@/components/auth/require-auth';
import { NotificationsList } from '@/components/notifications/NotificationsList';
import { DeviceSubscriptions } from '@/components/push-notifications/DeviceSubscriptions';
import { AdminLoadingSpinner } from '@/components/admin/admin-ui';

export default function NotificationsPage() {
  const { isLoading, isCreator } = useUser();

  const scrollClassName = 'max-md:pb-[calc(4rem+env(safe-area-inset-bottom,0px))]';

  if (isLoading) {
    return (
      <RequireAuth>
        <PageShell title="Notifications" subtitle="Your activity & earnings" scrollClassName={scrollClassName}>
          <AdminLoadingSpinner className="min-h-[320px]" />
        </PageShell>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <PageShell
        title="Notifications"
        subtitle="Your activity & earnings"
        scrollClassName={scrollClassName}
      >
        <div className="mx-auto w-full max-w-[640px] px-[22px] pt-[18px] pb-[60px]">
          <NotificationsList isCreator={isCreator} />
          <DeviceSubscriptions />
        </div>
      </PageShell>
    </RequireAuth>
  );
}
