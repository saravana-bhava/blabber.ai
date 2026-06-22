-- Refresh fiat_payment_processor description to include the new `goat` option.
-- Does NOT change the active value — admins flip it from the dashboard.
UPDATE public.platform_settings
SET
  description = 'Card/fiat processor for buying credits and for PPV/subscription/tip/product card checkout when credit_only_ecosystem is off. One of: onyx | stripe | moonpay | epoch | goat.',
  updated_at = timezone('utc'::text, now())
WHERE key = 'fiat_payment_processor';

-- 3DS / step-up redirect bookkeeping for GOAT Payments charges. Mirrors
-- pending_onyx_payments — the API route inserts a row before redirecting
-- the user, then the goat-callback page polls /api/goat/check-payment-status
-- which reads the row and finalizes the transaction.
CREATE TABLE IF NOT EXISTS public.pending_goat_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  transaction_id text NOT NULL,
  user_id uuid NOT NULL,
  transaction_type text NOT NULL,
  metadata_json jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT pending_goat_payments_pkey PRIMARY KEY (id),
  CONSTRAINT pending_goat_payments_transaction_id_key UNIQUE (transaction_id),
  CONSTRAINT pending_goat_payments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pending_goat_payments_transaction_id
  ON public.pending_goat_payments USING btree (transaction_id);
CREATE INDEX IF NOT EXISTS idx_pending_goat_payments_user_id
  ON public.pending_goat_payments USING btree (user_id);

ALTER TABLE public.pending_goat_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pending_goat_payments_select_own ON public.pending_goat_payments;
CREATE POLICY pending_goat_payments_select_own
  ON public.pending_goat_payments
  FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT policy: only the service role (backend) inserts rows.

DROP POLICY IF EXISTS pending_goat_payments_delete_own ON public.pending_goat_payments;
CREATE POLICY pending_goat_payments_delete_own
  ON public.pending_goat_payments
  FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.pending_goat_payments IS
  'Temporary storage for GOAT Payments 3DS / step-up flow; metadata keyed by transaction_id so the callback can complete the order.';
