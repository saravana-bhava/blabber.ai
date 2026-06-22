'use server';

import { createServiceRoleClient } from '@/lib/supabase/server';
import webpush from 'web-push';
import { ensureWebPushVapidConfigured } from '@/lib/web-push-vapid';

export async function sendAdminPushNotification({
  title,
  body,
  target
}: {
  title: string;
  body: string;
  target: 'all' | 'creators';
}) {
  try {
    if (!ensureWebPushVapidConfigured()) {
      console.warn('[PUSH] VAPID keys not set; skipping admin broadcast web push.');
      return {
        success: false,
        error: 'Push notifications not configured (set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY).',
      };
    }

    const supabase = createServiceRoleClient();
    
    let targetUserIds: string[] = [];

    if (target === 'creators') {
      // Get all creator profile IDs
      const { data: creators, error: creatorsError } = await supabase
        .from('creators')
        .select('profile_id');

      if (creatorsError) {
        throw new Error('Failed to fetch creators');
      }

      targetUserIds = creators?.map(c => c.profile_id) || [];
    } else {
      // Get all user IDs
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('id');

      if (usersError) {
        throw new Error('Failed to fetch users');
      }

      targetUserIds = users?.map(u => u.id) || [];
    }

    if (targetUserIds.length === 0) {
      return { 
        success: false, 
        error: `No ${target === 'creators' ? 'creators' : 'users'} found` 
      };
    }

    // Create notifications for all target users
    const notificationPromises = targetUserIds.map(userId =>
      supabase
        .from('notifications')
        .insert({
          user_id: userId,
          notification_type: 'admin_broadcast',
          title,
          body,
          data: {
            source: 'admin_dashboard',
            target
          }
        })
    );

    await Promise.all(notificationPromises);

    // Send push notifications
    const pushPromises = targetUserIds.map(async (userId) => {
      try {
        // Get user's active push subscriptions
        const { data: subscriptions } = await supabase
          .from('push_notification_subscriptions')
          .select('endpoint, p256dh_key, auth_key')
          .eq('user_id', userId)
          .eq('is_active', true);

        if (!subscriptions || subscriptions.length === 0) {
          return { userId, success: false, reason: 'No active subscriptions' };
        }

        // Send to all user's devices
        const devicePromises = subscriptions.map(async (subscription) => {
          try {
            const pushSubscription = {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh_key,
                auth: subscription.auth_key
              }
            } as webpush.PushSubscription;

            await webpush.sendNotification(
              pushSubscription,
              JSON.stringify({
                title,
                body,
                icon: '/icons/icon-192x192.png',
                data: {
                  source: 'admin_dashboard',
                  target
                }
              })
            );

            return { success: true, endpoint: subscription.endpoint };
          } catch (error) {
            console.error('Error sending to device:', error);
            
            // If subscription is invalid, mark it as inactive
            if (error instanceof Error && error.message.includes('410')) {
              await supabase
                .from('push_notification_subscriptions')
                .update({ is_active: false })
                .eq('endpoint', subscription.endpoint);
            }
            
            return { success: false, endpoint: subscription.endpoint, error };
          }
        });

        const deviceResults = await Promise.allSettled(devicePromises);
        const successfulDevices = deviceResults.filter(r => 
          r.status === 'fulfilled' && r.value.success
        ).length;

        return { 
          userId, 
          success: successfulDevices > 0, 
          devices: subscriptions.length,
          successfulDevices
        };
      } catch (error) {
        console.error('Error processing user:', userId, error);
        return { userId, success: false, error };
      }
    });

    const results = await Promise.allSettled(pushPromises);
    const successfulUsers = results.filter(r => 
      r.status === 'fulfilled' && r.value.success
    ).length;

    const totalUsers = targetUserIds.length;
    const targetLabel = target === 'creators' ? 'creators' : 'users';

    return { 
      success: true, 
      message: `Notification sent successfully! ${successfulUsers}/${totalUsers} ${targetLabel} received the notification.`,
      stats: {
        totalUsers,
        successfulUsers,
        targetLabel
      }
    };

  } catch (error) {
    console.error('Error sending admin push notifications:', error);
    return { 
      success: false, 
      error: 'Failed to send notifications. Please try again.' 
    };
  }
} 