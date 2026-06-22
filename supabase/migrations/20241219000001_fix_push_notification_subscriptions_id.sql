-- Drop and recreate the table to ensure proper structure
DROP TABLE IF EXISTS push_notification_subscriptions CASCADE;

-- Create push notification subscriptions table with proper defaults
CREATE TABLE push_notification_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  
  -- Ensure one subscription per user per endpoint
  UNIQUE(user_id, endpoint)
);

-- Create index for faster lookups
CREATE INDEX idx_push_subscriptions_user_id ON push_notification_subscriptions(user_id);
CREATE INDEX idx_push_subscriptions_active ON push_notification_subscriptions(is_active);

-- Enable RLS
ALTER TABLE push_notification_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own subscriptions" ON push_notification_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions" ON push_notification_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions" ON push_notification_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subscriptions" ON push_notification_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_push_notification_subscriptions_updated_at
  BEFORE UPDATE ON push_notification_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column(); 