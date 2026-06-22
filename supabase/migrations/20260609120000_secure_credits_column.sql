-- =============================================================================
-- Secure the credits column on profiles
--
-- Problem: the profiles_update_own RLS policy allowed authenticated users to
-- UPDATE any column on their own row — including `credits`. A user could call
-- supabase.from('profiles').update({ credits: 999999 }) from the browser and
-- RLS would pass because they were editing their own row.
--
-- Fix (two parts):
--   1. Revoke column-level UPDATE on `credits` from the authenticated role.
--      Service role (used by all server-side webhooks/API routes) is unaffected.
--   2. Extend debit_credits_if_sufficient so authenticated users can call it
--      directly (for client-side call billing and AI DM billing), while the
--      function itself enforces that a non-service-role caller can only debit
--      their own account (auth.uid() = p_user_id).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Revoke direct write access to the credits column from regular users.
--    Service role bypasses this — all webhook/API routes are unaffected.
-- -----------------------------------------------------------------------------
REVOKE UPDATE (credits) ON public.profiles FROM authenticated;


-- -----------------------------------------------------------------------------
-- 2. Rebuild debit_credits_if_sufficient with a caller self-check.
--
--    auth.uid() is NULL when called via service_role (no JWT context), so the
--    guard only activates for authenticated browser callers — and forces them
--    to only debit themselves.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.debit_credits_if_sufficient(
  p_user_id uuid,
  p_credits  integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_remaining integer;
BEGIN
  -- Reject nonsense amounts
  IF p_credits IS NULL OR p_credits < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount');
  END IF;

  -- When called by an authenticated user (not service_role), only allow
  -- self-debit. auth.uid() is NULL for service_role callers.
  IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  -- Atomic check-and-deduct: only updates if credits >= amount
  UPDATE public.profiles
  SET    credits = credits - p_credits
  WHERE  id = p_user_id
    AND  credits >= p_credits
  RETURNING credits INTO v_remaining;

  IF v_remaining IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_credits');
  END IF;

  RETURN jsonb_build_object('ok', true, 'credits_remaining', v_remaining);
END;
$$;

-- Allow authenticated users (browser clients) to call this function.
-- Service_role already has execute via the earlier migration.
REVOKE ALL ON FUNCTION public.debit_credits_if_sufficient(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debit_credits_if_sufficient(uuid, integer)
  TO authenticated, service_role;
