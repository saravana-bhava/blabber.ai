-- Local development seed (runs after migrations on `supabase db reset`).
-- Creates admin@blabber.ai (password: Admin123!@#) and grants admin + creator + agency roles.
-- Profile id matches auth.users.id (no hardcoded profile UUID).
-- Idempotent: safe to re-run on staging via npm run db:seed:remote.
-- Mock feed data loads next from supabase/seeds/*.sql (see config.toml [db.seed].sql_paths).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_user_id uuid;
  v_email text := 'admin@blabber.ai';
  v_password text := 'Admin123!@#';
  v_encrypted_pw text;
  v_now timestamptz := now();
  v_is_new boolean := false;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email LIMIT 1;

  v_encrypted_pw := crypt(v_password, gen_salt('bf'));

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    v_is_new := true;

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      v_encrypted_pw,
      v_now,
      v_now,
      v_now,
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Blabber Admin","username":"admin"}'::jsonb,
      v_now,
      v_now,
      '',
      '',
      '',
      ''
    );

    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      v_user_id,
      v_user_id::text,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email',
      v_now,
      v_now,
      v_now
    );
  ELSE
    UPDATE auth.users
    SET
      encrypted_password = v_encrypted_pw,
      email_confirmed_at = COALESCE(email_confirmed_at, v_now),
      updated_at = v_now
    WHERE id = v_user_id;

    IF NOT EXISTS (
      SELECT 1 FROM auth.identities
      WHERE user_id = v_user_id AND provider = 'email'
    ) THEN
      INSERT INTO auth.identities (
        id,
        user_id,
        provider_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        v_user_id,
        v_user_id::text,
        jsonb_build_object('sub', v_user_id::text, 'email', v_email),
        'email',
        v_now,
        v_now,
        v_now
      );
    END IF;
  END IF;

  INSERT INTO public.profiles (
    id, username, full_name, credits, "isAdmin", "isAllAccess",
    has_completed_intro_onboarding, updated_at
  ) VALUES (
    v_user_id, 'admin', 'Blabber Admin', 10000, true, true, true, v_now
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = 'Blabber Admin',
    username = COALESCE(public.profiles.username, 'admin'),
    "isAdmin" = true,
    "isAllAccess" = true,
    credits = GREATEST(public.profiles.credits, 10000),
    has_completed_intro_onboarding = true,
    updated_at = v_now;

  INSERT INTO public.creators (
    profile_id,
    is_demo,
    subscription_tier_enabled,
    subscription_price_cents,
    subscription_interval,
    ai_dms_enabled,
    ai_call_enabled,
    personality_prompt,
    eleven_voice_id,
    cartesia_voice_id,
    payment_provider,
    can_monetize,
    can_img_gen,
    veriff_verification_status,
    veriff_session_id,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    false,
    true,
    500,
    'month',
    false,
    false,
    NULL,
    NULL,
    NULL,
    'veriff',
    true,
    true,
    'completed',
    'seed_admin_kyc_bypass_' || v_user_id::text,
    v_now,
    v_now
  )
  ON CONFLICT (profile_id) DO UPDATE SET
    is_demo = EXCLUDED.is_demo,
    can_monetize = EXCLUDED.can_monetize,
    can_img_gen = EXCLUDED.can_img_gen,
    veriff_verification_status = EXCLUDED.veriff_verification_status,
    veriff_session_id = EXCLUDED.veriff_session_id,
    updated_at = EXCLUDED.updated_at;

  INSERT INTO public.agencies (
    profile_id,
    name,
    default_split_pct,
    veriff_verification_status,
    veriff_session_id,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    'Blabber Admin Agency',
    20.00,
    'completed',
    'seed_admin_agency_' || v_user_id::text,
    v_now,
    v_now
  )
  ON CONFLICT (profile_id) DO UPDATE SET
    name = EXCLUDED.name,
    veriff_verification_status = EXCLUDED.veriff_verification_status,
    veriff_session_id = EXCLUDED.veriff_session_id,
    updated_at = EXCLUDED.updated_at;

  RAISE NOTICE 'Seeded admin user: % (profile_id: %, new=%)',
    v_email, v_user_id, v_is_new;
END $$;
