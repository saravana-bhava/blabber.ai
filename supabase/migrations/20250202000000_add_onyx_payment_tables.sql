-- User payment methods for Onyx (and future rebilling)
-- Store only token/reference and display info; never store full card numbers.
CREATE TABLE IF NOT EXISTS public.user_payment_methods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  onyx_payment_method_id text NOT NULL,
  last4 character(4) NOT NULL,
  brand text,
  exp_month smallint,
  exp_year smallint,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT user_payment_methods_pkey PRIMARY KEY (id),
  CONSTRAINT user_payment_methods_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT user_payment_methods_user_onyx_id_unique UNIQUE (user_id, onyx_payment_method_id)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_user_payment_methods_user_id ON public.user_payment_methods USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_user_payment_methods_is_default ON public.user_payment_methods USING btree (user_id, is_default) WHERE is_default = true;

-- Pending Onyx payments (3DS flow): store metadata by transaction_id so we can complete after redirect
CREATE TABLE IF NOT EXISTS public.pending_onyx_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  transaction_id text NOT NULL,
  user_id uuid NOT NULL,
  transaction_type text NOT NULL,
  metadata_json jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT pending_onyx_payments_pkey PRIMARY KEY (id),
  CONSTRAINT pending_onyx_payments_transaction_id_key UNIQUE (transaction_id),
  CONSTRAINT pending_onyx_payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_pending_onyx_payments_transaction_id ON public.pending_onyx_payments USING btree (transaction_id);
CREATE INDEX IF NOT EXISTS idx_pending_onyx_payments_user_id ON public.pending_onyx_payments USING btree (user_id);

-- RLS for user_payment_methods: users can only manage their own
ALTER TABLE public.user_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_payment_methods_select_own ON public.user_payment_methods
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_payment_methods_insert_own ON public.user_payment_methods
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_payment_methods_update_own ON public.user_payment_methods
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY user_payment_methods_delete_own ON public.user_payment_methods
  FOR DELETE USING (auth.uid() = user_id);

-- RLS for pending_onyx_payments: users can read their own (for 3DS completion); service role can do all
ALTER TABLE public.pending_onyx_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY pending_onyx_payments_select_own ON public.pending_onyx_payments
  FOR SELECT USING (auth.uid() = user_id);

-- No INSERT policy: only service role (backend) can insert pending_onyx_payments

CREATE POLICY pending_onyx_payments_delete_own ON public.pending_onyx_payments
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_payment_methods IS 'Stored payment methods for Onyx rebilling (subscriptions). Only token and display info stored.';
COMMENT ON TABLE public.pending_onyx_payments IS 'Temporary storage for Onyx 3DS flow; metadata keyed by transaction_id for completion.';
