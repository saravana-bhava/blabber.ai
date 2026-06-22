-- Add USPaymate as an admin-selectable fiat/card processor.
UPDATE public.platform_settings
SET
  description = 'Card/fiat processor for buying credits and for PPV/subscription/tip/product card checkout when credit_only_ecosystem is off. One of: onyx | stripe | moonpay | epoch | goat | uspaymate.',
  updated_at = timezone('utc'::text, now())
WHERE key = 'fiat_payment_processor';

-- Pending hosted-checkout orders keyed by USPaymate order_key.
CREATE TABLE IF NOT EXISTS public.pending_uspaymate_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_key text NOT NULL,
  user_id uuid NOT NULL,
  transaction_type text NOT NULL,
  metadata_json jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT pending_uspaymate_payments_pkey PRIMARY KEY (id),
  CONSTRAINT pending_uspaymate_payments_order_key_key UNIQUE (order_key),
  CONSTRAINT pending_uspaymate_payments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pending_uspaymate_payments_order_key
  ON public.pending_uspaymate_payments USING btree (order_key);
CREATE INDEX IF NOT EXISTS idx_pending_uspaymate_payments_user_id
  ON public.pending_uspaymate_payments USING btree (user_id);

ALTER TABLE public.pending_uspaymate_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pending_uspaymate_payments_select_own ON public.pending_uspaymate_payments;
CREATE POLICY pending_uspaymate_payments_select_own
  ON public.pending_uspaymate_payments
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS pending_uspaymate_payments_delete_own ON public.pending_uspaymate_payments;
CREATE POLICY pending_uspaymate_payments_delete_own
  ON public.pending_uspaymate_payments
  FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.pending_uspaymate_payments IS
  'Temporary storage for USPaymate hosted checkout; metadata keyed by order_key for webhook/reconcile fulfillment.';
