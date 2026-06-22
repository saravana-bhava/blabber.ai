'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { randomUUID } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface NotificationBadgeProps {
  className?: string;
}

export function NotificationBadge({ className }: NotificationBadgeProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const fetchUnreadCount = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setUnreadCount(0);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .rpc('get_unread_notification_count', { p_user_id: user.id });

      if (error) {
        console.error('Error fetching unread count:', error);
        setUnreadCount(0);
      } else {
        setUnreadCount(data || 0);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      void fetchUnreadCount();

      channel = supabase
        .channel(`notifications:${user.id}:badge:${randomUUID()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => { void fetchUnreadCount(); }
        );

      if (cancelled) {
        supabase.removeChannel(channel);
        channel = null;
        return;
      }

      channel.subscribe();
    };

    void setup();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [fetchUnreadCount, supabase]);

  const handleClick = () => {
    router.push('/notifications');
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      className={`relative ${className}`}
      disabled={loading}
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 w-2 h-2 bg-pink-500 rounded-full border-2 border-background animate-pulse" />
      )}
    </Button>
  );
} 
