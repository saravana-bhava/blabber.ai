-- Idempotency table for credit spend requests.
-- Prevents double-charges when clients retry a request after a network timeout.
-- Entries are keyed by (user_id, idempotency_key) and expire after 24 hours.
CREATE TABLE IF NOT EXISTS public.credit_idempotency_keys (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  idem_key    TEXT        NOT NULL,
  result      JSONB       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, idem_key)
);

CREATE INDEX IF NOT EXISTS credit_idempotency_keys_created_at_idx
  ON public.credit_idempotency_keys (created_at);

ALTER TABLE public.credit_idempotency_keys ENABLE ROW LEVEL SECURITY;
-- No client-facing policies: service role only. RLS blocks all anon/authenticated access.
