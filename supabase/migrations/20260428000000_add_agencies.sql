-- =============================================================================
-- Agency account type
-- =============================================================================
-- Adds an Agency account type that can onboard and manage creators.
-- Agencies take a configurable per-creator slice of the existing creator share.
-- Schema is additive: no existing CHECK constraints are modified, no rows are
-- migrated. Every new column is nullable / defaulted so existing inserts keep
-- working without changes.

-- -----------------------------------------------------------------------------
-- 1. agencies table (parallel to creators)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agencies (
  profile_id uuid NOT NULL,
  name text NOT NULL,
  default_split_pct numeric(5, 2) NOT NULL DEFAULT 20.00,
  veriff_session_id text NULL,
  veriff_verification_status text NOT NULL DEFAULT 'not_started',
  veriff_estimated_age integer NULL,
  veriff_verification_results jsonb NULL,
  -- Payout-method columns mirroring creators
  payment_provider text NULL,
  solana_address text NULL,
  ethereum_address text NULL,
  polygon_address text NULL,
  bitcoin_address text NULL,
  bank_account_number text NULL,
  bank_routing_number text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT agencies_pkey PRIMARY KEY (profile_id),
  CONSTRAINT agencies_profile_id_fkey FOREIGN KEY (profile_id)
    REFERENCES public.profiles (id) ON DELETE CASCADE,
  CONSTRAINT chk_agency_default_split_pct CHECK (
    default_split_pct >= 0 AND default_split_pct <= 100
  ),
  CONSTRAINT chk_agency_veriff_status CHECK (
    veriff_verification_status IN ('not_started', 'in_progress', 'completed', 'rejected')
  )
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_agencies_veriff_session_id
  ON public.agencies USING btree (veriff_session_id) TABLESPACE pg_default;

COMMENT ON TABLE public.agencies IS 'Agency account type: a profile that onboards and manages multiple creators and earns a configurable cut of those creators'' share.';
COMMENT ON COLUMN public.agencies.default_split_pct IS 'Percentage (0-100) of each managed creator''s share that the agency keeps by default. Per-creator overrides live on creators.agency_split_pct_override.';

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_agencies_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_agencies_updated_at ON public.agencies;
CREATE TRIGGER update_agencies_updated_at
  BEFORE UPDATE ON public.agencies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_agencies_updated_at();

-- -----------------------------------------------------------------------------
-- 2. creators: link to agency
-- -----------------------------------------------------------------------------
ALTER TABLE public.creators
  ADD COLUMN IF NOT EXISTS agency_profile_id uuid NULL,
  ADD COLUMN IF NOT EXISTS agency_split_pct_override numeric(5, 2) NULL,
  ADD COLUMN IF NOT EXISTS is_agency_operated boolean NOT NULL DEFAULT false;

ALTER TABLE public.creators
  DROP CONSTRAINT IF EXISTS creators_agency_profile_id_fkey;
ALTER TABLE public.creators
  ADD CONSTRAINT creators_agency_profile_id_fkey
  FOREIGN KEY (agency_profile_id) REFERENCES public.agencies (profile_id)
  ON DELETE SET NULL;

ALTER TABLE public.creators
  DROP CONSTRAINT IF EXISTS chk_creators_agency_split_pct_override;
ALTER TABLE public.creators
  ADD CONSTRAINT chk_creators_agency_split_pct_override CHECK (
    agency_split_pct_override IS NULL
    OR (agency_split_pct_override >= 0 AND agency_split_pct_override <= 100)
  );

CREATE INDEX IF NOT EXISTS idx_creators_agency_profile_id
  ON public.creators USING btree (agency_profile_id) TABLESPACE pg_default;

COMMENT ON COLUMN public.creators.agency_profile_id IS 'When set, this creator is managed by the agency at the given profile id.';
COMMENT ON COLUMN public.creators.agency_split_pct_override IS 'Optional per-creator override for the agency cut (% of creator share). Falls back to agencies.default_split_pct.';
COMMENT ON COLUMN public.creators.is_agency_operated IS 'True while the agency operates the account on behalf of the creator (creator has not yet claimed it).';

-- -----------------------------------------------------------------------------
-- 3. Transaction tables: add agency columns (additive, nullable)
-- -----------------------------------------------------------------------------
-- Helper: each transaction table gets:
--   agency_profile_id      uuid NULL -> agencies(profile_id)
--   agency_share_cents     integer NULL CHECK (NULL OR 0 <= x <= creator_share_cents)
--   agency_payout_id       uuid NULL -> payouts(id)

DO $$
DECLARE
  tbl text;
  share_col text;
  tables text[] := ARRAY[
    'call_transactions',
    'subscription_payments',
    'tip_transactions',
    'ppv_transactions',
    'creator_product_transactions'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format(
      'ALTER TABLE public.%I
         ADD COLUMN IF NOT EXISTS agency_profile_id uuid NULL,
         ADD COLUMN IF NOT EXISTS agency_share_cents integer NULL,
         ADD COLUMN IF NOT EXISTS agency_payout_id uuid NULL',
      tbl
    );

    EXECUTE format(
      'ALTER TABLE public.%I
         DROP CONSTRAINT IF EXISTS %I',
      tbl, tbl || '_agency_profile_id_fkey'
    );
    EXECUTE format(
      'ALTER TABLE public.%I
         ADD CONSTRAINT %I FOREIGN KEY (agency_profile_id)
         REFERENCES public.agencies (profile_id) ON DELETE SET NULL',
      tbl, tbl || '_agency_profile_id_fkey'
    );

    EXECUTE format(
      'ALTER TABLE public.%I
         DROP CONSTRAINT IF EXISTS %I',
      tbl, tbl || '_agency_payout_id_fkey'
    );
    EXECUTE format(
      'ALTER TABLE public.%I
         ADD CONSTRAINT %I FOREIGN KEY (agency_payout_id)
         REFERENCES public.payouts (id) ON DELETE SET NULL',
      tbl, tbl || '_agency_payout_id_fkey'
    );

    EXECUTE format(
      'ALTER TABLE public.%I
         DROP CONSTRAINT IF EXISTS %I',
      tbl, 'chk_' || tbl || '_agency_share_bounds'
    );
    EXECUTE format(
      'ALTER TABLE public.%I
         ADD CONSTRAINT %I CHECK (
           agency_share_cents IS NULL
           OR (agency_share_cents >= 0
               AND agency_share_cents <= COALESCE(creator_share_cents, 0))
         )',
      tbl, 'chk_' || tbl || '_agency_share_bounds'
    );

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I USING btree (agency_profile_id)',
      'idx_' || tbl || '_agency_profile_id', tbl
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I USING btree (agency_payout_id)',
      'idx_' || tbl || '_agency_payout_id', tbl
    );
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. payouts: distinguish creator vs agency payouts
-- -----------------------------------------------------------------------------
ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS payee_kind text NOT NULL DEFAULT 'creator';

ALTER TABLE public.payouts
  DROP CONSTRAINT IF EXISTS chk_payouts_payee_kind;
ALTER TABLE public.payouts
  ADD CONSTRAINT chk_payouts_payee_kind
  CHECK (payee_kind IN ('creator', 'agency'));

COMMENT ON COLUMN public.payouts.payee_kind IS 'Whether this payout settles a creator''s take-home or an agency''s aggregated commission.';

CREATE INDEX IF NOT EXISTS idx_payouts_payee_kind
  ON public.payouts USING btree (payee_kind) TABLESPACE pg_default;

-- -----------------------------------------------------------------------------
-- 5. RLS policies for agencies (owner-only + admin full access)
-- -----------------------------------------------------------------------------
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agencies_owner_select ON public.agencies;
CREATE POLICY agencies_owner_select ON public.agencies
  FOR SELECT
  USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS agencies_owner_insert ON public.agencies;
CREATE POLICY agencies_owner_insert ON public.agencies
  FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS agencies_owner_update ON public.agencies;
CREATE POLICY agencies_owner_update ON public.agencies
  FOR UPDATE
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS agencies_admin_all ON public.agencies;
CREATE POLICY agencies_admin_all ON public.agencies
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p."isAdmin" = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p."isAdmin" = true
    )
  );

-- -----------------------------------------------------------------------------
-- 6. Additive RLS for downstream tables (no-op when RLS is disabled)
-- -----------------------------------------------------------------------------
-- These policies apply only if RLS is later enabled on the target tables. They
-- give an agency owner read access to their managed creators and the
-- transaction rows attributed to their agency. Existing service-role flows are
-- unaffected.

DROP POLICY IF EXISTS creators_agency_select ON public.creators;
CREATE POLICY creators_agency_select ON public.creators
  FOR SELECT
  USING (agency_profile_id = auth.uid());

DROP POLICY IF EXISTS creators_agency_update ON public.creators;
CREATE POLICY creators_agency_update ON public.creators
  FOR UPDATE
  USING (agency_profile_id = auth.uid())
  WITH CHECK (agency_profile_id = auth.uid());

DROP POLICY IF EXISTS profiles_agency_select_managed ON public.profiles;
CREATE POLICY profiles_agency_select_managed ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.creators c
      WHERE c.profile_id = public.profiles.id
        AND c.agency_profile_id = auth.uid()
    )
  );

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'call_transactions',
    'subscription_payments',
    'tip_transactions',
    'ppv_transactions',
    'creator_product_transactions'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      tbl || '_agency_select', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I
         FOR SELECT USING (agency_profile_id = auth.uid())',
      tbl || '_agency_select', tbl
    );
  END LOOP;
END;
$$;

-- PostgREST API access (RLS policies above enforce row access)
GRANT ALL ON TABLE public.agencies TO anon;
GRANT ALL ON TABLE public.agencies TO authenticated;
GRANT ALL ON TABLE public.agencies TO service_role;
