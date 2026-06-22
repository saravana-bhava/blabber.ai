-- Store encrypted card number for subscription rebills (Onyx does not provide tokens).
-- CVV is never stored (PCI). Recurring charges use empty CVV.
ALTER TABLE public.user_payment_methods
  ADD COLUMN IF NOT EXISTS encrypted_card_number text;

COMMENT ON COLUMN public.user_payment_methods.encrypted_card_number IS 'AES-256-GCM encrypted full card number for rebills; never store CVV.';
