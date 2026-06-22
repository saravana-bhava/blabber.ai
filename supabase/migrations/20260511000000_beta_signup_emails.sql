-- Public beta waitlist emails from the marketing site.
CREATE TABLE public.beta_signup_emails (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT beta_signup_emails_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX beta_signup_emails_email_normalized_unique
  ON public.beta_signup_emails (lower(trim(email)));

COMMENT ON TABLE public.beta_signup_emails IS 'Email addresses collected from the public beta waitlist form.';
COMMENT ON COLUMN public.beta_signup_emails.email IS 'Subscriber email; use lower(trim()) from the client for a stable key matching the unique index.';

ALTER TABLE public.beta_signup_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can join beta waitlist"
  ON public.beta_signup_emails
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    char_length(trim(email)) >= 5
    AND char_length(trim(email)) <= 320
    AND position('@' in trim(email)) > 1
  );

CREATE POLICY "Admins can read beta signup emails"
  ON public.beta_signup_emails
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p."isAdmin" = true
    )
  );

GRANT INSERT ON TABLE public.beta_signup_emails TO anon;
GRANT INSERT ON TABLE public.beta_signup_emails TO authenticated;
GRANT SELECT ON TABLE public.beta_signup_emails TO authenticated;
