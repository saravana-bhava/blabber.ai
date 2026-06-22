-- Create bug_reports table
CREATE TABLE public.bug_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  severity text NOT NULL,
  steps_to_reproduce text NULL,
  expected_behavior text NULL,
  actual_behavior text NULL,
  browser text NULL,
  device text NULL,
  additional_info text NULL,
  status text NOT NULL DEFAULT 'open',
  admin_notes text NULL,
  assigned_to uuid NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  resolved_at timestamp with time zone NULL,
  CONSTRAINT bug_reports_pkey PRIMARY KEY (id),
  CONSTRAINT bug_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT bug_reports_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT bug_reports_category_check CHECK (category IN ('ui_ux', 'functionality', 'performance', 'payment', 'media', 'notifications', 'mobile', 'other')),
  CONSTRAINT bug_reports_severity_check CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT bug_reports_status_check CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'duplicate')),
  CONSTRAINT bug_reports_title_length_check CHECK (char_length(title) >= 5),
  CONSTRAINT bug_reports_description_length_check CHECK (char_length(description) >= 10)
) TABLESPACE pg_default;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bug_reports_user_id ON public.bug_reports USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON public.bug_reports USING btree (status) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_bug_reports_severity ON public.bug_reports USING btree (severity) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_bug_reports_category ON public.bug_reports USING btree (category) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_bug_reports_created_at ON public.bug_reports USING btree (created_at DESC) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_bug_reports_assigned_to ON public.bug_reports USING btree (assigned_to) TABLESPACE pg_default;

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_bug_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_bug_reports_updated_at_trigger
  BEFORE UPDATE ON public.bug_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_bug_reports_updated_at();

-- Add RLS (Row Level Security) policies
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own bug reports
CREATE POLICY "Users can view own bug reports" ON public.bug_reports
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own bug reports
CREATE POLICY "Users can insert own bug reports" ON public.bug_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own bug reports (only certain fields)
CREATE POLICY "Users can update own bug reports" ON public.bug_reports
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can view all bug reports (you'll need to implement admin role logic)
-- This is a placeholder - you may want to create a separate admin role or use a different approach
CREATE POLICY "Admins can view all bug reports" ON public.bug_reports
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.username IN ('admin', 'moderator') -- Adjust based on your admin identification logic
    )
  );

-- Add comments for documentation
COMMENT ON TABLE public.bug_reports IS 'Stores user-submitted bug reports and feature requests';
COMMENT ON COLUMN public.bug_reports.id IS 'Unique identifier for the bug report';
COMMENT ON COLUMN public.bug_reports.user_id IS 'ID of the user who submitted the report';
COMMENT ON COLUMN public.bug_reports.title IS 'Brief title/description of the bug';
COMMENT ON COLUMN public.bug_reports.description IS 'Detailed description of the bug';
COMMENT ON COLUMN public.bug_reports.category IS 'Category of the bug (ui_ux, functionality, performance, etc.)';
COMMENT ON COLUMN public.bug_reports.severity IS 'Severity level of the bug (low, medium, high, critical)';
COMMENT ON COLUMN public.bug_reports.steps_to_reproduce IS 'Step-by-step instructions to reproduce the bug';
COMMENT ON COLUMN public.bug_reports.expected_behavior IS 'What the user expected to happen';
COMMENT ON COLUMN public.bug_reports.actual_behavior IS 'What actually happened';
COMMENT ON COLUMN public.bug_reports.browser IS 'Browser/application version information';
COMMENT ON COLUMN public.bug_reports.device IS 'Device and operating system information';
COMMENT ON COLUMN public.bug_reports.additional_info IS 'Any additional information provided by the user';
COMMENT ON COLUMN public.bug_reports.status IS 'Current status of the bug report';
COMMENT ON COLUMN public.bug_reports.admin_notes IS 'Internal notes from administrators/developers';
COMMENT ON COLUMN public.bug_reports.assigned_to IS 'ID of the admin/developer assigned to handle this report';
COMMENT ON COLUMN public.bug_reports.created_at IS 'Timestamp when the report was created';
COMMENT ON COLUMN public.bug_reports.updated_at IS 'Timestamp when the report was last updated';
COMMENT ON COLUMN public.bug_reports.resolved_at IS 'Timestamp when the report was resolved'; 