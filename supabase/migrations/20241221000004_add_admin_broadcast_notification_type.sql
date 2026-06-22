-- Add admin_broadcast notification type
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS valid_notification_types;

ALTER TABLE notifications ADD CONSTRAINT valid_notification_types CHECK (
  notification_type IN (
    -- Creator notifications
    'post_comment',
    'post_like', 
    'post_comment_reply',
    'subscriber_new_post',
    'subscriber_live_stream',
    'post_tip',
    'ppv_purchase',
    'new_subscription',
    'product_purchase',
    
    -- User notifications
    'order_shipped',
    'order_delivered',
    
    -- Admin notifications
    'admin_broadcast'
  )
); 