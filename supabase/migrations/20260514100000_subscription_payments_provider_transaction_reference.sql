-- App code and other transaction tables use provider_transaction_reference; some DBs only had
-- provider_payment_reference on subscription_payments. Add the column and backfill for PostgREST.

ALTER TABLE public.subscription_payments
  ADD COLUMN IF NOT EXISTS provider_transaction_reference text NULL;

COMMENT ON COLUMN public.subscription_payments.provider_transaction_reference IS
  'Provider reference for this payment (credit ref, Stripe PI, Onyx tx id, etc.).';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscription_payments'
      AND column_name = 'provider_payment_reference'
  ) THEN
    UPDATE public.subscription_payments
    SET provider_transaction_reference = provider_payment_reference
    WHERE provider_transaction_reference IS NULL
      AND provider_payment_reference IS NOT NULL;
  END IF;
END $$;
