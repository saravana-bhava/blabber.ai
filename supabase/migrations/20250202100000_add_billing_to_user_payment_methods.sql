-- Add billing address to user_payment_methods so we can send it when charging a saved card (Onyx requires it).
ALTER TABLE public.user_payment_methods
  ADD COLUMN IF NOT EXISTS billing_phone_number text,
  ADD COLUMN IF NOT EXISTS billing_address text,
  ADD COLUMN IF NOT EXISTS billing_city text,
  ADD COLUMN IF NOT EXISTS billing_state text,
  ADD COLUMN IF NOT EXISTS billing_zip text,
  ADD COLUMN IF NOT EXISTS billing_first_name text,
  ADD COLUMN IF NOT EXISTS billing_last_name text,
  ADD COLUMN IF NOT EXISTS billing_email text;

COMMENT ON COLUMN public.user_payment_methods.billing_phone_number IS 'Billing phone when card was saved; required by Onyx when charging saved card.';
