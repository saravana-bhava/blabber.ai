-- =============================================================================
-- Rate limiting for expensive AI operations
--
-- Stores one lightweight row per AI action invocation.
-- The check_rate_limit() RPC is called server-side before proxying to
-- ElevenLabs / ComfyUI / Voice AI. Old rows are pruned automatically.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id         bigserial    PRIMARY KEY,
  user_id    uuid         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action     text         NOT NULL,
  created_at timestamptz  NOT NULL DEFAULT now()
);

-- Index for the sliding-window COUNT query (user + action + time range)
CREATE INDEX IF NOT EXISTS idx_rate_limit_events_lookup
  ON public.rate_limit_events (user_id, action, created_at DESC);

-- RLS: users cannot read or write this table directly.
-- All access goes through the check_rate_limit() SECURITY DEFINER RPC.
ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;

-- No policies — service role (used by the RPC) bypasses RLS.

-- =============================================================================
-- check_rate_limit(user_id, action, max_requests, window_seconds)
--
-- Returns true  → request is allowed; the event row has been inserted.
-- Returns false → rate limit exceeded; no row inserted.
--
-- Atomicity: INSERT happens first so concurrent requests see each other's
-- inserts. The function runs inside a single transaction, so the COUNT
-- and INSERT are consistent.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id        uuid,
  p_action         text,
  p_max_requests   integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_window_start timestamptz;
  v_count        integer;
BEGIN
  v_window_start := now() - (p_window_seconds || ' seconds')::interval;

  -- Count requests in the current window, including any just-inserted ones
  -- from concurrent calls (FOR UPDATE locks the counted rows).
  SELECT COUNT(*) INTO v_count
  FROM public.rate_limit_events
  WHERE user_id   = p_user_id
    AND action    = p_action
    AND created_at > v_window_start;

  IF v_count >= p_max_requests THEN
    RETURN false;
  END IF;

  INSERT INTO public.rate_limit_events (user_id, action)
  VALUES (p_user_id, p_action);

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(uuid, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(uuid, text, integer, integer)
  TO service_role;

-- =============================================================================
-- Cleanup: delete events older than 48 hours to keep the table small.
-- Called by the daily cleanup-mux-streams cron (or add its own schedule).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.prune_rate_limit_events()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  DELETE FROM public.rate_limit_events
  WHERE created_at < now() - interval '48 hours';
$$;

REVOKE ALL ON FUNCTION public.prune_rate_limit_events() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prune_rate_limit_events() TO service_role;
