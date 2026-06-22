'use server'

import webpush from 'web-push'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { ensureWebPushVapidConfigured } from '@/lib/web-push-vapid'

export async function subscribeUser(subscriptionData: {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}) {
  
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('❌ User not authenticated:', userError)
      return { success: false, error: 'User not authenticated' }
    }

    // Store subscription in database
    const { error: insertError } = await supabase
      .from('push_notification_subscriptions')
      .upsert({
        user_id: user.id,
        endpoint: subscriptionData.endpoint,
        p256dh_key: subscriptionData.keys.p256dh,
        auth_key: subscriptionData.keys.auth,
        is_active: true
      }, {
        onConflict: 'user_id,endpoint'
      })

    if (insertError) {
      console.error('❌ Error storing subscription:', insertError)
      return { success: false, error: 'Failed to store subscription' }
    }

    return { success: true }
  } catch (error) {
    console.error('❌ Error in subscribeUser:', error)
    return { success: false, error: 'Failed to subscribe user' }
  }
}

export async function unsubscribeUser() {
  
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('❌ User not authenticated:', userError)
      return { success: false, error: 'User not authenticated' }
    }

    // Mark all user subscriptions as inactive
    const { error: updateError } = await supabase
      .from('push_notification_subscriptions')
      .update({ is_active: false })
      .eq('user_id', user.id)

    if (updateError) {
      console.error('❌ Error unsubscribing user:', updateError)
      return { success: false, error: 'Failed to unsubscribe user' }
    }

    return { success: true }
  } catch (error) {
    console.error('❌ Error in unsubscribeUser:', error)
    return { success: false, error: 'Failed to unsubscribe user' }
  }
}

export async function sendNotification(message: string, userId?: string, title?: string, data?: any) {
  
  try {
    if (!ensureWebPushVapidConfigured()) {
      console.warn('[PUSH] VAPID keys not set; skipping web push (build-safe).')
      return { success: false, error: 'Push notifications not configured' }
    }

    const cookieStore = await cookies()
    
    // Get current user if not provided
    let targetUserId = userId
    if (!targetUserId) {
      const supabase = createClient(cookieStore)
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        console.error('❌ User not authenticated:', userError)
        return { success: false, error: 'User not authenticated' }
      }
      targetUserId = user.id
    }

    // Use service role client to access other users' subscriptions
    const supabase = createServiceRoleClient()

    // Get user's active subscriptions
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_notification_subscriptions')
      .select('endpoint, p256dh_key, auth_key')
      .eq('user_id', targetUserId)
      .eq('is_active', true)

    if (fetchError) {
      console.error('❌ Error fetching subscriptions:', fetchError)
      return { success: false, error: 'Failed to fetch subscriptions' }
    }

    if (!subscriptions || subscriptions.length === 0) {
      return { success: false, error: 'No active subscriptions found' }
    }

    // Send notification to all user's devices
    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh_key,
            auth: subscription.auth_key
          }
        } as webpush.PushSubscription

        try {
          const result = await webpush.sendNotification(
            pushSubscription,
            JSON.stringify({
              title: title || 'Blabber Notification',
              body: message,
              icon: '/icons/icon-192x192.png',
              data: data || {}
            })
          )
          return { success: true, endpoint: subscription.endpoint }
        } catch (error) {
          console.error('❌ Error sending notification to endpoint:', subscription.endpoint, error)
          
          // If subscription is invalid, mark it as inactive
          if (error instanceof Error && error.message.includes('410')) {
            await supabase
              .from('push_notification_subscriptions')
              .update({ is_active: false })
              .eq('endpoint', subscription.endpoint)
          }
          
          return { success: false, endpoint: subscription.endpoint, error }
        }
      })
    )

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length
    const failed = results.length - successful

    return { 
      success: successful > 0, 
      results: {
        total: results.length,
        successful,
        failed
      }
    }
  } catch (error) {
    console.error('❌ Error in sendNotification:', error)
    return { success: false, error: 'Failed to send notification' }
  }
}

// Helper function to send notification to all users (for admin/broadcast use)
export async function sendNotificationToAllUsers(message: string) {
  
  try {
    if (!ensureWebPushVapidConfigured()) {
      console.warn('[PUSH] VAPID keys not set; skipping broadcast web push.')
      return { success: false, error: 'Push notifications not configured' }
    }

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    
    // Get all active subscriptions
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_notification_subscriptions')
      .select('endpoint, p256dh_key, auth_key')
      .eq('is_active', true)

    if (fetchError) {
      console.error('❌ Error fetching all subscriptions:', fetchError)
      return { success: false, error: 'Failed to fetch subscriptions' }
    }

    if (!subscriptions || subscriptions.length === 0) {
      return { success: false, error: 'No active subscriptions found' }
    }

    // Send notification to all devices
    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh_key,
            auth: subscription.auth_key
          }
        } as webpush.PushSubscription

        try {
          const result = await webpush.sendNotification(
            pushSubscription,
            JSON.stringify({
              title: 'Blabber Notification',
              body: message,
              icon: '/icons/icon-192x192.png',
            })
          )
          return { success: true, endpoint: subscription.endpoint }
        } catch (error) {
          console.error('❌ Error sending notification to endpoint:', subscription.endpoint, error)
          
          // If subscription is invalid, mark it as inactive
          if (error instanceof Error && error.message.includes('410')) {
            await supabase
              .from('push_notification_subscriptions')
              .update({ is_active: false })
              .eq('endpoint', subscription.endpoint)
          }
          
          return { success: false, endpoint: subscription.endpoint, error }
        }
      })
    )

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length
    const failed = results.length - successful

    return { 
      success: successful > 0, 
      results: {
        total: results.length,
        successful,
        failed
      }
    }
  } catch (error) {
    console.error('❌ Error in sendNotificationToAllUsers:', error)
    return { success: false, error: 'Failed to send broadcast notification' }
  }
} 