'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Smartphone, Monitor, CheckCircle, XCircle, Bell } from 'lucide-react';
import { AdminCard } from '@/components/admin/admin-ui';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface DeviceSubscription {
  id: string;
  endpoint: string;
  is_active: boolean;
  created_at: string;
  device_type?: 'mobile' | 'desktop';
}

export function DeviceSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<DeviceSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('push_notification_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching subscriptions:', error);
        return;
      }

      const subscriptionsWithDeviceType =
        data?.map((sub) => ({
          ...sub,
          device_type: detectDeviceTypeFromEndpoint(sub.endpoint),
        })) || [];

      setSubscriptions(subscriptionsWithDeviceType);
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const detectDeviceTypeFromEndpoint = (endpoint: string): 'mobile' | 'desktop' => {
    if (endpoint.includes('fcm.googleapis.com')) {
      return 'mobile';
    }
    return 'desktop';
  };

  const getDeviceLabel = (deviceType: 'mobile' | 'desktop') =>
    deviceType === 'mobile' ? 'Mobile device' : 'Desktop device';

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  if (loading) {
    return (
      <AdminCard padding="default" className="!p-4 mt-5">
        <Skeleton className="mb-2 h-4 w-40" />
        <Skeleton className="mb-4 h-3.5 w-56" />
        <Skeleton className="h-10 w-full" />
      </AdminCard>
    );
  }

  const activeSubscriptions = subscriptions.filter((sub) => sub.is_active);
  const inactiveSubscriptions = subscriptions.filter((sub) => !sub.is_active);
  const allDevices = [...activeSubscriptions, ...inactiveSubscriptions];

  return (
    <AdminCard padding="default" className="!p-4 mt-5">
      <div className="mb-3.5">
        <h3 className="text-[14.5px] font-bold">Push notifications</h3>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Devices that can receive alerts
        </p>
      </div>

      {allDevices.length === 0 ? (
        <div className="py-3 text-center">
          <Bell className="mx-auto mb-2 h-7 w-7 text-muted-foreground/60" />
          <p className="text-[13px] text-muted-foreground">No device subscriptions yet</p>
          <p className="mt-1 text-[12px] text-muted-foreground/80">
            Enable notifications on any device to see them here
          </p>
        </div>
      ) : (
        <div>
          {allDevices.map((subscription, index) => {
            const deviceType = subscription.device_type || 'desktop';
            const DeviceIcon = deviceType === 'mobile' ? Smartphone : Monitor;

            return (
              <div
                key={subscription.id}
                className={cn(
                  'flex items-center justify-between gap-3 py-2.5',
                  index > 0 && 'border-t border-border',
                  !subscription.is_active && 'opacity-60',
                )}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground"
                    style={{ background: 'var(--secondary)' }}
                  >
                    <DeviceIcon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-medium">
                      {getDeviceLabel(deviceType)}
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      Subscribed {formatDate(subscription.created_at)}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {subscription.is_active ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                      <span className="text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
                        Active
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span className="text-[12px] font-medium text-red-600 dark:text-red-400">
                        Inactive
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminCard>
  );
}
