'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow, subHours } from 'date-fns';
import {
  MessageCircle,
  Heart,
  Video,
  DollarSign,
  ShoppingCart,
  Package,
  Loader2,
  Star,
  Lock,
  Sparkles,
  Bell,
  type LucideIcon,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { AdminCard, AdminGhostButton } from '@/components/admin/admin-ui';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  user_id: string;
  actor_id: string | null;
  notification_type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
  actor?: {
    username: string;
    avatar_url: string | null;
  };
}

type NotificationFilter = 'all' | 'earnings';

const EARNING_TYPES = new Set([
  'post_tip',
  'ppv_purchase',
  'new_subscription',
  'product_purchase',
]);

type NotificationMeta = {
  icon: LucideIcon;
  bg: string;
  neutral?: boolean;
  fillIcon?: boolean;
};

const NOTIF_META: Record<string, NotificationMeta> = {
  new_subscription: { icon: Star, bg: 'var(--brand-grad)' },
  post_tip: {
    icon: DollarSign,
    bg: 'linear-gradient(135deg, oklch(0.8 0.13 86), oklch(0.72 0.15 60))',
  },
  ppv_purchase: { icon: Lock, bg: 'var(--brand-grad)' },
  product_purchase: {
    icon: ShoppingCart,
    bg: 'linear-gradient(135deg, oklch(0.7 0.15 150), oklch(0.6 0.16 190))',
  },
  post_comment: { icon: MessageCircle, bg: 'var(--secondary)', neutral: true },
  post_comment_reply: { icon: MessageCircle, bg: 'var(--secondary)', neutral: true },
  post_like: { icon: Heart, bg: 'var(--secondary)', neutral: true, fillIcon: true },
  subscriber_new_post: { icon: Video, bg: 'var(--secondary)', neutral: true },
  subscriber_live_stream: { icon: Video, bg: 'var(--secondary)', neutral: true },
  order_shipped: { icon: Package, bg: 'var(--secondary)', neutral: true },
  order_delivered: { icon: Package, bg: 'var(--secondary)', neutral: true },
  admin_broadcast: { icon: Sparkles, bg: 'var(--secondary)', neutral: true },
};

function getNotificationMeta(type: string): NotificationMeta {
  return NOTIF_META[type] ?? { icon: Bell, bg: 'var(--secondary)', neutral: true };
}

function getNotificationAmount(notification: Notification): number | null {
  const raw = notification.data?.amount;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const parsed = parseFloat(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  const match = notification.body.match(/\$[\d,]+(?:\.\d{2})?/);
  if (match) return parseFloat(match[0].replace(/[$,]/g, ''));
  return null;
}

function formatAmount(amount: number): string {
  return `+$${amount.toLocaleString(undefined, {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function NotificationFilterTabs({
  active,
  onChange,
}: {
  active: NotificationFilter;
  onChange: (filter: NotificationFilter) => void;
}) {
  const tabs: { id: NotificationFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'earnings', label: 'Earnings' },
  ];

  return (
    <div className="flex gap-1.5" role="tablist" aria-label="Notification filter">
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              'rounded-full border px-[15px] py-[7px] text-[13px] font-semibold transition-[color,background,box-shadow] duration-150',
              isActive
                ? 'border-transparent text-[var(--brand-on-accent)]'
                : 'border-border bg-secondary text-muted-foreground hover:text-foreground',
            )}
            style={
              isActive
                ? { background: 'var(--brand-grad)', boxShadow: 'var(--brand-ring-money)' }
                : undefined
            }
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function NotificationsEmptyState({ filter }: { filter: NotificationFilter }) {
  return (
    <div className="grid min-h-[40vh] place-items-center px-6 py-14 text-center">
      <div className="max-w-[360px]">
        <div
          className="mx-auto mb-4 grid h-[60px] w-[60px] place-items-center rounded-[18px] text-muted-foreground/70"
          style={{ background: 'var(--secondary)' }}
        >
          <Bell className="h-[26px] w-[26px]" aria-hidden />
        </div>
        <h2 className="font-display text-xl tracking-tight mb-2">
          {filter === 'earnings' ? 'No earnings yet' : 'No notifications yet'}
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {filter === 'earnings'
            ? 'Tips, subscriptions, and purchases will show up here.'
            : "When you get notifications, they'll appear here."}
        </p>
      </div>
    </div>
  );
}

function NotificationAvatar({
  notification,
  meta,
}: {
  notification: Notification;
  meta: NotificationMeta;
}) {
  const Icon = meta.icon;
  const hasActor = !!notification.actor?.avatar_url;

  return (
    <div className="relative shrink-0">
      {hasActor ? (
        <div className="h-[46px] w-[46px] overflow-hidden rounded-full border border-border bg-muted">
          <img
            src={notification.actor!.avatar_url!}
            alt={notification.actor!.username}
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div
          className="grid h-[46px] w-[46px] place-items-center rounded-xl text-[var(--brand-pink)]"
          style={{ background: meta.bg }}
        >
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
      )}
      {hasActor && (
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 grid h-[22px] w-[22px] place-items-center rounded-full border-[2.5px] border-background',
            meta.neutral ? 'text-muted-foreground' : 'text-white',
          )}
          style={{ background: meta.bg }}
        >
          <Icon
            className="h-[11px] w-[11px]"
            strokeWidth={meta.fillIcon ? 0 : 2.2}
            fill={meta.fillIcon ? 'currentColor' : 'none'}
          />
        </span>
      )}
    </div>
  );
}

export function NotificationsList({ isCreator = false }: { isCreator?: boolean }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingRead, setMarkingRead] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('notifications')
        .select(
          `
          *,
          actor:actor_id(username, avatar_url)
        `,
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching notifications:', error);
        return;
      }

      setNotifications((data as Notification[]) || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const dismissNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase.from('notifications').delete().eq('id', notificationId);

      if (error) {
        console.error('Error dismissing notification:', error);
        return false;
      }

      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      return true;
    } catch (error) {
      console.error('Error dismissing notification:', error);
      return false;
    }
  };

  const markAllAsRead = async () => {
    setMarkingRead(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.rpc('mark_notifications_read', { p_user_id: user.id });

      if (error) {
        console.error('Error marking all notifications as read:', error);
        return;
      }

      setNotifications((prev) => prev.map((notif) => ({ ...notif, is_read: true })));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    } finally {
      setMarkingRead(false);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    const dismissed = await dismissNotification(notification.id);
    if (!dismissed) {
      toast.error('Could not dismiss notification');
      return;
    }

    const data = notification.data ?? {};

    if (typeof data.route === 'string' && data.route) {
      router.push(data.route);
      return;
    }

    switch (notification.notification_type) {
      case 'post_comment':
      case 'post_like':
      case 'post_comment_reply':
      case 'post_tip':
        if (typeof data.post_id === 'string') {
          router.push(`/broadcast/${data.post_id}`);
        }
        break;
      case 'subscriber_new_post':
      case 'subscriber_live_stream':
        if (notification.actor?.username) {
          router.push(`/u/${notification.actor.username}`);
        }
        break;
      case 'ppv_purchase':
      case 'new_subscription':
      case 'product_purchase':
        router.push('/creator-orders');
        break;
      case 'order_shipped':
      case 'order_delivered':
        router.push('/transactions');
        break;
      default:
        if (notification.actor?.username) {
          router.push(`/u/${notification.actor.username}`);
        }
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const filteredNotifications = useMemo(() => {
    if (filter === 'earnings') {
      return notifications.filter((n) => EARNING_TYPES.has(n.notification_type));
    }
    return notifications;
  }, [notifications, filter]);

  const earningsLast24h = useMemo(() => {
    const cutoff = subHours(new Date(), 24);
    return notifications
      .filter(
        (n) =>
          EARNING_TYPES.has(n.notification_type) && new Date(n.created_at) >= cutoff,
      )
      .reduce((sum, n) => sum + (getNotificationAmount(n) ?? 0), 0);
  }, [notifications]);

  if (loading) {
    return (
      <div className="space-y-3">
        {isCreator && (
          <Skeleton className="h-[74px] w-full rounded-[18px]" />
        )}
        <div className="flex gap-1.5">
          <Skeleton className="h-9 w-16 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3.5 py-3.5">
            <Skeleton className="h-[46px] w-[46px] rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isCreator && (
        <AdminCard
          padding="default"
          className="!p-4 flex items-center gap-3.5 [background:var(--brand-grad-soft)]"
        >
          <span
            className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl text-white"
            style={{ background: 'var(--brand-grad)' }}
          >
            <DollarSign className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[22px] tracking-tight tabular-nums">
              ${earningsLast24h.toFixed(2)}
            </div>
            <div className="text-[12.5px] font-semibold text-muted-foreground">
              earned in the last 24 hours
            </div>
          </div>
          <AdminGhostButton asChild size="sm" className="h-9 shrink-0 px-3.5 text-[13px]">
            <Link href="/creator-dashboard">Dashboard</Link>
          </AdminGhostButton>
        </AdminCard>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <NotificationFilterTabs active={filter} onChange={setFilter} />
        {unreadCount > 0 && (
          <AdminGhostButton
            onClick={markAllAsRead}
            disabled={markingRead}
            size="sm"
            className="h-9 px-3.5 text-[13px]"
          >
            {markingRead ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Mark all as read'
            )}
          </AdminGhostButton>
        )}
      </div>

      {filteredNotifications.length === 0 ? (
        <NotificationsEmptyState filter={filter} />
      ) : (
        <div className="divide-y divide-border">
          {filteredNotifications.map((notification) => {
            const meta = getNotificationMeta(notification.notification_type);
            const amount = getNotificationAmount(notification);

            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => handleNotificationClick(notification)}
                className={cn(
                  'flex w-full items-center gap-3.5 px-1.5 py-3.5 text-left transition-colors hover:bg-secondary/60',
                  !notification.is_read && 'bg-[var(--brand-grad-soft)]/60',
                )}
              >
                <NotificationAvatar notification={notification} meta={meta} />

                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'text-[14px] leading-snug',
                      !notification.is_read ? 'font-medium' : undefined,
                    )}
                  >
                    {notification.body}
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground/80">
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                  </p>
                </div>

                {amount != null && (
                  <span
                    className="shrink-0 rounded-full px-2.5 py-1 text-[13px] font-bold tabular-nums text-[var(--brand-gold)]"
                    style={{ background: 'var(--brand-grad-soft)' }}
                  >
                    {formatAmount(amount)}
                  </span>
                )}

                {!notification.is_read && amount == null && (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: 'var(--brand-pink)' }}
                    aria-label="Unread"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
