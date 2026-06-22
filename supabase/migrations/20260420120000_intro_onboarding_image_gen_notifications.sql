-- First-login intro: existing users are treated as completed; new profiles default to false via handle_new_user / app inserts.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_completed_intro_onboarding boolean;

UPDATE public.profiles
SET has_completed_intro_onboarding = true
WHERE has_completed_intro_onboarding IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN has_completed_intro_onboarding SET DEFAULT false;

ALTER TABLE public.profiles
  ALTER COLUMN has_completed_intro_onboarding SET NOT NULL;

INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'image_gen_credit_cost',
  '10',
  'Credits deducted per AI image generation (creator tools)'
)
ON CONFLICT (key) DO NOTHING;

-- Allow users to remove notifications from their inbox when acted on
CREATE POLICY "Users can delete their own notifications"
  ON public.notifications
  FOR DELETE
  USING (auth.uid() = user_id);
