-- Extend the public beta waitlist with the social context we collect at signup
-- and the review/approval lifecycle the admin page needs.
ALTER TABLE public.beta_signup_emails
  ADD COLUMN IF NOT EXISTS instagram_handle text,
  ADD COLUMN IF NOT EXISTS other_socials text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS notes text;

-- Status is one of pending / approved / archived. Reject anything else so the
-- admin UI can rely on the constrained set.
ALTER TABLE public.beta_signup_emails
  DROP CONSTRAINT IF EXISTS beta_signup_emails_status_check;
ALTER TABLE public.beta_signup_emails
  ADD CONSTRAINT beta_signup_emails_status_check
  CHECK (status IN ('pending', 'approved', 'archived'));

CREATE INDEX IF NOT EXISTS beta_signup_emails_status_created_at_idx
  ON public.beta_signup_emails (status, created_at DESC);

COMMENT ON COLUMN public.beta_signup_emails.instagram_handle IS
  'Instagram username collected at signup (without @). Optional but encouraged so we can vet creators.';
COMMENT ON COLUMN public.beta_signup_emails.other_socials IS
  'Free-form additional social handles (TikTok, X, YouTube, etc.) entered at signup.';
COMMENT ON COLUMN public.beta_signup_emails.status IS
  'Lifecycle for the admin waitlist review page: pending (default), approved, or archived.';
COMMENT ON COLUMN public.beta_signup_emails.reviewed_at IS
  'When an admin last changed status away from pending.';
COMMENT ON COLUMN public.beta_signup_emails.reviewed_by IS
  'Admin profile id that approved/archived this entry.';
COMMENT ON COLUMN public.beta_signup_emails.approved_email_sent_at IS
  'When the acceptance email was last successfully dispatched via Resend.';

-- Tighten the public insert policy so anonymous submissions can't backdoor
-- themselves into "approved" or pre-fill review fields. Drop and recreate so
-- migrations are idempotent across re-runs.
DROP POLICY IF EXISTS "Anyone can join beta waitlist" ON public.beta_signup_emails;
CREATE POLICY "Anyone can join beta waitlist"
  ON public.beta_signup_emails
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    char_length(trim(email)) >= 5
    AND char_length(trim(email)) <= 320
    AND position('@' in trim(email)) > 1
    AND coalesce(status, 'pending') = 'pending'
    AND reviewed_at IS NULL
    AND reviewed_by IS NULL
    AND approved_email_sent_at IS NULL
    AND (instagram_handle IS NULL OR char_length(trim(instagram_handle)) <= 64)
    AND (other_socials IS NULL OR char_length(trim(other_socials)) <= 1000)
  );

-- Admins update status, notes, reviewed_by, reviewed_at, approved_email_sent_at
-- from the waitlist review page. Server-side admin routes also use the service
-- role, but this lets the dashboard work directly against the API if needed.
DROP POLICY IF EXISTS "Admins can update beta signup emails" ON public.beta_signup_emails;
CREATE POLICY "Admins can update beta signup emails"
  ON public.beta_signup_emails
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p."isAdmin" = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p."isAdmin" = true
    )
  );

GRANT UPDATE ON TABLE public.beta_signup_emails TO authenticated;
