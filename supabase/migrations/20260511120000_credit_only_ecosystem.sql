-- Platform setting: when true, PPV / subscriptions / tips / marketplace charge credits (USD-equivalent) instead of card/crypto.
INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'credit_only_ecosystem',
  'false',
  'When true, fans pay for PPV, subscriptions, tips, and marketplace items with credits (USD list price shown with credit cost in parentheses). Buying credits still uses normal payment providers.'
)
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  updated_at = timezone('utc'::text, now());

-- Atomic debit: only decreases credits if balance is sufficient (service role only).
CREATE OR REPLACE FUNCTION public.debit_credits_if_sufficient(p_user_id uuid, p_credits integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining integer;
BEGIN
  IF p_credits IS NULL OR p_credits < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount');
  END IF;
  UPDATE public.profiles
  SET credits = credits - p_credits
  WHERE id = p_user_id AND credits >= p_credits
  RETURNING credits INTO v_remaining;
  IF v_remaining IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_credits');
  END IF;
  RETURN jsonb_build_object('ok', true, 'credits_remaining', v_remaining);
END;
$$;

REVOKE ALL ON FUNCTION public.debit_credits_if_sufficient(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debit_credits_if_sufficient(uuid, integer) TO service_role;

-- Restore credits if a purchase record fails after debit (service role only).
CREATE OR REPLACE FUNCTION public.refund_credits(p_user_id uuid, p_credits integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_credits IS NULL OR p_credits < 1 THEN
    RETURN;
  END IF;
  UPDATE public.profiles
  SET credits = credits + p_credits
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.refund_credits(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_credits(uuid, integer) TO service_role;
