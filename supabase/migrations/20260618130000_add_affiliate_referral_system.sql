-- =============================================================================
-- Affiliate & Universal Referral System
-- =============================================================================
-- Every profile gets a referral_code and a referred_by_profile_id.
-- affiliate_profiles stores KYC status + payout details for verified affiliates.
-- platform_settings is a generic key/value store for runtime configuration.

-- -----------------------------------------------------------------------------
-- 1. profiles: referral_code + referred_by_profile_id
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text NULL,
  ADD COLUMN IF NOT EXISTS referred_by_profile_id uuid NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_referral_code_unique;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_referral_code_unique UNIQUE (referral_code);

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_referred_by_profile_id_fkey;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_referred_by_profile_id_fkey
  FOREIGN KEY (referred_by_profile_id) REFERENCES public.profiles (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_referral_code
  ON public.profiles USING btree (referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by_profile_id
  ON public.profiles USING btree (referred_by_profile_id);

-- Helper: generate an 8-char lowercase alphanumeric code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars  text := 'abcdefghijklmnopqrstuvwxyz0123456789';
  code   text;
  i      int;
  clash  int;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..8 LOOP
      code := code || substr(chars, floor(random() * 36 + 1)::int, 1);
    END LOOP;
    SELECT COUNT(*) INTO clash FROM public.profiles WHERE referral_code = code;
    EXIT WHEN clash = 0;
  END LOOP;
  RETURN code;
END;
$$;

-- Trigger: auto-assign referral_code on INSERT if not provided
CREATE OR REPLACE FUNCTION public.trg_profiles_set_referral_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := public.generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_set_referral_code ON public.profiles;
CREATE TRIGGER trg_profiles_set_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_profiles_set_referral_code();

-- Backfill existing profiles that have no referral_code
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE referral_code IS NULL LOOP
    UPDATE public.profiles
      SET referral_code = public.generate_referral_code()
      WHERE id = r.id;
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. affiliate_profiles table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.affiliate_profiles (
  profile_id             uuid NOT NULL,
  name                   text NOT NULL,
  veriff_session_id      text NULL,
  veriff_status          text NOT NULL DEFAULT 'not_started',
  veriff_estimated_age   integer NULL,
  veriff_results         jsonb NULL,
  commission_pct_1       numeric(5, 2) NOT NULL DEFAULT 5.00,
  commission_pct_2       numeric(5, 2) NOT NULL DEFAULT 2.00,
  payment_provider       text NULL,
  solana_address         text NULL,
  ethereum_address       text NULL,
  polygon_address        text NULL,
  bitcoin_address        text NULL,
  bank_account_number    text NULL,
  bank_routing_number    text NULL,
  created_at             timestamp with time zone NOT NULL DEFAULT timezone('utc', now()),
  updated_at             timestamp with time zone NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT affiliate_profiles_pkey PRIMARY KEY (profile_id),
  CONSTRAINT affiliate_profiles_profile_id_fkey FOREIGN KEY (profile_id)
    REFERENCES public.profiles (id) ON DELETE CASCADE,
  CONSTRAINT chk_affiliate_veriff_status CHECK (
    veriff_status IN ('not_started', 'in_progress', 'completed', 'rejected')
  ),
  CONSTRAINT chk_affiliate_commission_pct_1 CHECK (commission_pct_1 >= 0 AND commission_pct_1 <= 100),
  CONSTRAINT chk_affiliate_commission_pct_2 CHECK (commission_pct_2 >= 0 AND commission_pct_2 <= 100)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_affiliate_profiles_veriff_session_id
  ON public.affiliate_profiles USING btree (veriff_session_id);

CREATE OR REPLACE FUNCTION public.update_affiliate_profiles_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_affiliate_profiles_updated_at ON public.affiliate_profiles;
CREATE TRIGGER update_affiliate_profiles_updated_at
  BEFORE UPDATE ON public.affiliate_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_affiliate_profiles_updated_at();

-- RLS
ALTER TABLE public.affiliate_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS affiliate_profiles_owner_select ON public.affiliate_profiles;
CREATE POLICY affiliate_profiles_owner_select ON public.affiliate_profiles
  FOR SELECT USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS affiliate_profiles_owner_insert ON public.affiliate_profiles;
CREATE POLICY affiliate_profiles_owner_insert ON public.affiliate_profiles
  FOR INSERT WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS affiliate_profiles_owner_update ON public.affiliate_profiles;
CREATE POLICY affiliate_profiles_owner_update ON public.affiliate_profiles
  FOR UPDATE USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS affiliate_profiles_admin_all ON public.affiliate_profiles;
CREATE POLICY affiliate_profiles_admin_all ON public.affiliate_profiles
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p."isAdmin" = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p."isAdmin" = true));

GRANT ALL ON TABLE public.affiliate_profiles TO anon;
GRANT ALL ON TABLE public.affiliate_profiles TO authenticated;
GRANT ALL ON TABLE public.affiliate_profiles TO service_role;

-- -----------------------------------------------------------------------------
-- 3. platform_settings table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key   text NOT NULL,
  value jsonb NOT NULL,
  CONSTRAINT platform_settings_pkey PRIMARY KEY (key)
) TABLESPACE pg_default;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_settings_public_read ON public.platform_settings;
CREATE POLICY platform_settings_public_read ON public.platform_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS platform_settings_admin_write ON public.platform_settings;
CREATE POLICY platform_settings_admin_write ON public.platform_settings
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p."isAdmin" = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p."isAdmin" = true));

GRANT ALL ON TABLE public.platform_settings TO anon;
GRANT ALL ON TABLE public.platform_settings TO authenticated;
GRANT ALL ON TABLE public.platform_settings TO service_role;

-- Seed default settings (idempotent)
INSERT INTO public.platform_settings (key, value) VALUES
  ('affiliate_require_kyc',    'true'::jsonb),
  ('referral_credit_amount',   '1000'::jsonb),
  ('referral_credits_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. payouts.payee_kind — extend to include 'affiliate'
-- -----------------------------------------------------------------------------
ALTER TABLE public.payouts
  DROP CONSTRAINT IF EXISTS chk_payouts_payee_kind;
ALTER TABLE public.payouts
  ADD CONSTRAINT chk_payouts_payee_kind
  CHECK (payee_kind IN ('creator', 'agency', 'affiliate'));

COMMENT ON TABLE public.affiliate_profiles IS 'Affiliate account role: any profile that has applied and been verified as an affiliate. Presence of a row = is_affiliate=true.';
COMMENT ON COLUMN public.profiles.referral_code IS 'Unique 8-char code used in blabber.ai/ref/<code> share links. Auto-generated on profile insert.';
COMMENT ON COLUMN public.profiles.referred_by_profile_id IS 'The profile that referred this user via their referral link. Set once on first login after clicking a /ref/<code> link.';
