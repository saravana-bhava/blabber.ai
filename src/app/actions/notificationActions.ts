'use server';

import { createServiceRoleClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { sendNotification } from '@/app/actions/pushNotifications';

export async function createNotification({
  userId,
  actorId,
  notificationType,
  title,
  body,
  data = {}
}: {
  userId: string;
  actorId?: string;
  notificationType: string;
  title: string;
  body: string;
  data?: any;
}) {
  const supabase = createServiceRoleClient();

  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      actor_id: actorId,
      notification_type: notificationType,
      title,
      body,
      data
    });

  if (error) {
    console.error('Error creating notification:', error);
    throw error;
  }

  // Also send push notification
  try {
    await sendNotification(body, userId, title, data);
  } catch (pushError) {
    console.error('Error sending push notification:', pushError);
    // Don't fail the notification creation if push notification fails
  }

  return { success: true };
}

export async function markNotificationAsRead(notificationId: string) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }

  return { success: true };
}

export async function markAllNotificationsAsRead(userId: string) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { error } = await supabase
    .rpc('mark_notifications_read', { p_user_id: userId });

  if (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }

  return { success: true };
}

export async function getUnreadNotificationCount(userId: string) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data, error } = await supabase
    .rpc('get_unread_notification_count', { p_user_id: userId });

  if (error) {
    console.error('Error getting unread notification count:', error);
    return 0;
  }

  return data || 0;
}

// Helper functions for common notification types
export async function createPostCommentNotification({
  postCreatorId,
  commenterId,
  commenterUsername,
  postId
}: {
  postCreatorId: string;
  commenterId: string;
  commenterUsername: string;
  postId: string;
}) {
  return createNotification({
    userId: postCreatorId,
    actorId: commenterId,
    notificationType: 'post_comment',
    title: 'Comment',
    body: `${commenterUsername} commented on your post`,
    data: { post_id: postId, route: `/p/${postId}` }
  });
}

export async function createCommentReplyNotification({
  commentAuthorId,
  replierId,
  replierUsername,
  postId,
  commentId
}: {
  commentAuthorId: string;
  replierId: string;
  replierUsername: string;
  postId: string;
  commentId: string;
}) {
  return createNotification({
    userId: commentAuthorId,
    actorId: replierId,
    notificationType: 'post_comment_reply',
    title: 'Reply',
    body: `${replierUsername} replied to your comment`,
    data: { post_id: postId, comment_id: commentId, route: `/p/${postId}` }
  });
}

export async function createPostLikeNotification({
  postCreatorId,
  likerId,
  likerUsername,
  postId
}: {
  postCreatorId: string;
  likerId: string;
  likerUsername: string;
  postId: string;
}) {
  return createNotification({
    userId: postCreatorId,
    actorId: likerId,
    notificationType: 'post_like',
    title: 'Like',
    body: `${likerUsername} liked your post`,
    data: { post_id: postId, route: `/p/${postId}` }
  });
}

export async function createNewSubscriptionNotification({
  creatorId,
  subscriberId,
  subscriberUsername
}: {
  creatorId: string;
  subscriberId: string;
  subscriberUsername: string;
}) {
  return createNotification({
    userId: creatorId,
    actorId: subscriberId,
    notificationType: 'new_subscription',
    title: 'Subscriber',
    body: `${subscriberUsername} subscribed to you`,
    data: { route: '/creator-orders' }
  });
}

export async function createTipNotification({
  creatorId,
  tipperId,
  tipperUsername,
  amount,
  postId
}: {
  creatorId: string;
  tipperId: string;
  tipperUsername: string;
  amount: number;
  postId?: string;
}) {
  return createNotification({
    userId: creatorId,
    actorId: tipperId,
    notificationType: 'post_tip',
    title: 'Tip',
    body: `${tipperUsername} tipped you $${amount.toFixed(2)}`,
    data: { 
      post_id: postId, 
      amount,
      route: postId ? `/p/${postId}` : '/creator-orders'
    }
  });
}

export async function createPPVPurchaseNotification({
  creatorId,
  buyerId,
  buyerUsername,
  postId,
  amount
}: {
  creatorId: string;
  buyerId: string;
  buyerUsername: string;
  postId: string;
  amount: number;
}) {
  return createNotification({
    userId: creatorId,
    actorId: buyerId,
    notificationType: 'ppv_purchase',
    title: 'Purchase',
    body: `${buyerUsername} purchased your PPV content for $${amount.toFixed(2)}`,
    data: { post_id: postId, amount, route: `/p/${postId}` }
  });
}

export async function createProductPurchaseNotification({
  creatorId,
  buyerId,
  buyerUsername,
  productName,
  amount
}: {
  creatorId: string;
  buyerId: string;
  buyerUsername: string;
  productName: string;
  amount: number;
}) {
  return createNotification({
    userId: creatorId,
    actorId: buyerId,
    notificationType: 'product_purchase',
    title: 'Order',
    body: `${buyerUsername} purchased ${productName} for $${amount.toFixed(2)}`,
    data: { product_name: productName, amount, route: '/creator-orders' }
  });
}

export async function createOrderShippedNotification({
  buyerId,
  creatorId,
  creatorUsername,
  productName,
  trackingNumber,
  estimatedDeliveryDate
}: {
  buyerId: string;
  creatorId: string;
  creatorUsername: string;
  productName: string;
  trackingNumber: string;
  estimatedDeliveryDate: string;
}) {
  return createNotification({
    userId: buyerId,
    actorId: creatorId,
    notificationType: 'order_shipped',
    title: 'Shipped',
    body: `${creatorUsername} has shipped your ${productName} order`,
    data: { 
      product_name: productName, 
      tracking_number: trackingNumber,
      estimated_delivery_date: estimatedDeliveryDate,
      route: '/transactions'
    }
  });
}

export async function createOrderDeliveredNotification({
  buyerId,
  creatorId,
  creatorUsername,
  productName
}: {
  buyerId: string;
  creatorId: string;
  creatorUsername: string;
  productName: string;
}) {
  return createNotification({
    userId: buyerId,
    actorId: creatorId,
    notificationType: 'order_delivered',
    title: 'Delivered',
    body: `${creatorUsername} has marked your ${productName} order as delivered`,
    data: { 
      product_name: productName,
      route: '/transactions'
    }
  });
}

export async function createSubscriberNewPostNotification({
  subscriberId,
  creatorId,
  creatorUsername,
  postId,
  postType
}: {
  subscriberId: string;
  creatorId: string;
  creatorUsername: string;
  postId: string;
  postType: string;
}) {
  const postTypeLabel = postType === 'short' ? 'short' : 
                       postType === 'video' ? 'video' : 
                       postType === 'poll' ? 'poll' : 
                       postType === 'quiz' ? 'quiz' : 'post';
  

  return createNotification({
    userId: subscriberId,
    actorId: creatorId,
    notificationType: 'subscriber_new_post',
    title: 'New Post',
    body: `${creatorUsername} just posted a new ${postTypeLabel}`,
    data: { 
      post_id: postId, 
      post_type: postType,
      route: `/p/${postId}`
    }
  });
} 