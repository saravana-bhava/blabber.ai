-- Create notifications table
CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Who triggered the notification
  notification_type TEXT NOT NULL, -- Type of notification
  title TEXT NOT NULL, -- Notification title
  body TEXT NOT NULL, -- Notification body/message
  data JSONB DEFAULT '{}', -- Additional data for routing and display
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes for performance
  CONSTRAINT valid_notification_types CHECK (
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
      'order_delivered'
    )
  )
);

-- Create indexes for performance
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_type ON notifications(notification_type);
CREATE INDEX idx_notifications_actor_id ON notifications(actor_id);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Function to create notifications
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_actor_id UUID,
  p_notification_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO notifications (
    user_id,
    actor_id,
    notification_type,
    title,
    body,
    data
  ) VALUES (
    p_user_id,
    p_actor_id,
    p_notification_type,
    p_title,
    p_body,
    p_data
  ) RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark notifications as read
CREATE OR REPLACE FUNCTION mark_notifications_read(
  p_user_id UUID,
  p_notification_ids UUID[] DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  IF p_notification_ids IS NULL THEN
    -- Mark all user's notifications as read
    UPDATE notifications 
    SET is_read = true 
    WHERE user_id = p_user_id AND is_read = false;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
  ELSE
    -- Mark specific notifications as read
    UPDATE notifications 
    SET is_read = true 
    WHERE user_id = p_user_id 
      AND id = ANY(p_notification_ids) 
      AND is_read = false;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
  END IF;
  
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  count INTEGER;
BEGIN
  SELECT COUNT(*) INTO count
  FROM notifications
  WHERE user_id = p_user_id AND is_read = false;
  
  RETURN count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_notification(UUID, UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_notifications_read(UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_notification_count(UUID) TO authenticated; 