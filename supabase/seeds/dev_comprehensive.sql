-- =============================================================================
-- Blabber local dev seed (comprehensive)
-- Runs after migrations on `supabase db reset`, or manually:
--   npm run db:seed
--
-- Primary dev account (created in ../seed.sql):
--   Email: admin@blabber.ai  |  Password: Admin123!@#
--   Roles: admin + agency + verified creator (profile_id = auth.users.id)
--
-- Other seed users password: BlabberDev1!
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers (dropped at end)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._dev_seed_auth_user(
  p_id uuid,
  p_email text,
  p_password text DEFAULT 'BlabberDev1!',
  p_full_name text DEFAULT 'Seed User',
  p_avatar_url text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
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
    p_id,
    'authenticated',
    'authenticated',
    p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    timezone('utc', now()),
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'full_name', p_full_name,
      'name', p_full_name,
      'avatar_url', p_avatar_url
    ),
    timezone('utc', now()),
    timezone('utc', now()),
    '', '', '', ''
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    email_confirmed_at = COALESCE(auth.users.email_confirmed_at, EXCLUDED.email_confirmed_at),
    updated_at = timezone('utc', now());

  INSERT INTO auth.identities (
    id,
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    p_id::text,
    p_id,
    jsonb_build_object('sub', p_id::text, 'email', p_email),
    'email',
    timezone('utc', now()),
    timezone('utc', now()),
    timezone('utc', now())
  )
  ON CONFLICT (provider_id, provider) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public._dev_seed_upsert_profile(
  p_id uuid,
  p_username text,
  p_full_name text,
  p_bio text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL,
  p_banner_url text DEFAULT NULL,
  p_credits integer DEFAULT 500,
  p_is_admin boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, username, full_name, bio, avatar_url, banner_url, credits,
    "isAdmin", has_completed_intro_onboarding, location, website, updated_at
  ) VALUES (
    p_id, p_username, p_full_name, p_bio, p_avatar_url, p_banner_url, p_credits,
    p_is_admin, true, NULL, NULL, timezone('utc', now())
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    bio = COALESCE(EXCLUDED.bio, public.profiles.bio),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    banner_url = COALESCE(EXCLUDED.banner_url, public.profiles.banner_url),
    credits = GREATEST(public.profiles.credits, EXCLUDED.credits),
    "isAdmin" = public.profiles."isAdmin" OR EXCLUDED."isAdmin",
    has_completed_intro_onboarding = true,
    updated_at = timezone('utc', now());
END;
$$;

-- ---------------------------------------------------------------------------
-- Fixed IDs
-- ---------------------------------------------------------------------------
DO $seed$
DECLARE
  dev_admin_id uuid;
  dev_admin_email text := 'admin@blabber.ai';

  -- Mux public demo asset (Big Buck Bunny) — works without your Mux token
  -- Mux docs public demo asset (https://www.mux.com/docs/guides/play-your-videos)
  mux_demo text := 'uNbxnGLKJ00yfbijDO8COxTOyVKT01xpxW';

  agency_rival_id uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380001';
  creator_ids uuid[] := ARRAY[
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380101'::uuid,
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380102'::uuid,
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380103'::uuid,
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380104'::uuid,
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380105'::uuid,
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380106'::uuid,
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380107'::uuid,
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380108'::uuid
  ];
  fan_ids uuid[] := ARRAY[
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380201'::uuid,
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380202'::uuid,
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380203'::uuid,
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380204'::uuid,
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380205'::uuid,
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380206'::uuid,
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380207'::uuid,
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380208'::uuid,
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380209'::uuid,
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380210'::uuid
  ];

  creator_usernames text[] := ARRAY[
    'sarah_mitchell', 'james_orozco', 'nia_patel', 'marcus_chen',
    'elena_vasquez', 'tyler_brooks', 'maya_johnson', 'derek_hayes'
  ];
  creator_names text[] := ARRAY[
    'Sarah Mitchell', 'James Orosco', 'Nia Patel', 'Marcus Chen',
    'Elena Vasquez', 'Tyler Brooks', 'Maya Johnson', 'Derek Hayes'
  ];
  creator_bios text[] := ARRAY[
    'Fitness & lifestyle. LA based. New programs every month.',
    'Music producer + studio sessions. DM for collabs.',
    'Skincare routines that actually work. Not sponsored fluff.',
    'Street photography & travel diaries from 40+ countries.',
    'Chef at home — weeknight meals under 30 minutes.',
    'Gaming, tech reviews, and the occasional hot take.',
    'Wellness coach | breathwork retreats | podcast Thursdays',
    'Vintage fashion finds & styling tips for real wardrobes'
  ];

  fan_usernames text[] := ARRAY[
    'emma_walsh', 'liam_torres', 'sofia_ruiz', 'noah_park',
    'ava_miller', 'oliver_kim', 'chloe_davis', 'ethan_bell',
    'grace_nguyen', 'henry_scott'
  ];
  fan_names text[] := ARRAY[
    'Emma Walsh', 'Liam Torres', 'Sofia Ruiz', 'Noah Park',
    'Ava Miller', 'Oliver Kim', 'Chloe Davis', 'Ethan Bell',
    'Grace Nguyen', 'Henry Scott'
  ];

  i int;
  j int;
  post_idx int;
  post_count int;
  like_k int;
  uid uuid;
  cid uuid;
  post_id uuid;
  conv_id uuid;
  msg_id uuid;
  sub_id uuid;
  amt int;
  creator_share int;
  platform_share int;
  agency_share int;
  days_ago int;
  post_captions text[] := ARRAY[
    'Golden hour in Malibu — this light never gets old.',
    'Friday drop is live. Link in bio for early access.',
    'Behind the scenes from yesterday''s shoot. More coming soon.',
    'Ask me anything in the comments — picking 10 to answer tonight.',
    'Three years of this journey. Thank you for being here.',
    'New routine starts Monday. Who''s in?',
    'Unfiltered and unapologetic. That''s the whole brand.',
    'Save this for later — you''ll want it.',
    'Streaming tonight at 8pm ET. Set your reminders.',
    'What should I film next? Actually need ideas.'
  ];
  comment_texts text[] := ARRAY[
    'This is incredible 🔥', 'Needed this today, thank you!',
    'How do I get on the waitlist?', 'Following for part 2',
    'Sent this to my whole group chat', 'Chef''s kiss honestly'
  ];
  product_names text[] := ARRAY[
    'Signed Print — Limited Run', 'Exclusive Hoodie Drop',
    'Digital Preset Pack', 'VIP Meet & Greet Bundle'
  ];
  all_user_ids uuid[];
  seed_already boolean;
BEGIN
  SELECT id INTO dev_admin_id FROM auth.users WHERE email = dev_admin_email LIMIT 1;
  IF dev_admin_id IS NULL THEN
    RAISE EXCEPTION 'dev_comprehensive: run seed.sql first (missing %)', dev_admin_email;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE username = 'sarah_mitchell'
  ) INTO seed_already;

  UPDATE public.profiles
  SET
    bio = COALESCE(bio, 'Local dev admin — full platform access for testing.'),
    avatar_url = COALESCE(avatar_url, 'https://i.pravatar.cc/300?u=blabber-admin'),
    banner_url = COALESCE(banner_url, 'https://picsum.photos/seed/admin-banner/1200/400'),
    credits = GREATEST(credits, 10000),
    "isAdmin" = true,
    "isAllAccess" = true,
    has_completed_intro_onboarding = true,
    updated_at = timezone('utc', now())
  WHERE id = dev_admin_id;

  IF seed_already THEN
    RAISE NOTICE 'Dev seed: bulk demo data present; admin % profile refreshed.', dev_admin_email;
    RETURN;
  END IF;

  -- Rival agency owner (for marketplace / agency UI variety)
  PERFORM public._dev_seed_auth_user(
    agency_rival_id,
    'rival.agency@blabber.local',
    'BlabberDev1!',
    'Jordan Blake',
    'https://i.pravatar.cc/300?u=jordan_blake'
  );
  PERFORM public._dev_seed_upsert_profile(
    agency_rival_id, 'jordan_blake', 'Jordan Blake',
    'Talent manager | Atlas Media Collective', 'https://i.pravatar.cc/300?u=jordan_blake', NULL, 800, false
  );
  INSERT INTO public.agencies (profile_id, name, default_split_pct, veriff_verification_status, veriff_session_id)
  VALUES (agency_rival_id, 'Atlas Media Collective', 25.00, 'completed', 'seed_veriff_agency_rival')
  ON CONFLICT (profile_id) DO NOTHING;

  -- Creators under Vertex (Melchor agency)
  FOR i IN 1..array_length(creator_ids, 1) LOOP
    uid := creator_ids[i];
    PERFORM public._dev_seed_auth_user(
      uid,
      creator_usernames[i] || '@blabber.local',
      'BlabberDev1!',
      creator_names[i],
      'https://i.pravatar.cc/300?u=' || creator_usernames[i]
    );
    PERFORM public._dev_seed_upsert_profile(
      uid, creator_usernames[i], creator_names[i], creator_bios[i],
      'https://i.pravatar.cc/300?u=' || creator_usernames[i],
      'https://picsum.photos/seed/' || creator_usernames[i] || '-banner/1200/400',
      200 + (i * 37), false
    );
    INSERT INTO public.creators (
      profile_id, can_monetize, stripe_onboarding_status, subscription_tier_enabled,
      subscription_price_cents, subscription_interval, veriff_verification_status,
      veriff_session_id, agency_profile_id, is_agency_operated, is_demo,
      ai_call_enabled, ai_dms_enabled, payment_provider
    ) VALUES (
      uid, true, 'completed', true,
      CASE WHEN i % 3 = 0 THEN 0 ELSE 499 + (i * 100) END,
      'month', 'completed',
      'seed_veriff_' || creator_usernames[i],
      dev_admin_id, false, false,
      i % 2 = 0, i % 3 = 0, 'veriff'
    )
    ON CONFLICT (profile_id) DO NOTHING;
  END LOOP;

  -- Fans
  FOR i IN 1..array_length(fan_ids, 1) LOOP
    uid := fan_ids[i];
    PERFORM public._dev_seed_auth_user(
      uid,
      fan_usernames[i] || '@blabber.local',
      'BlabberDev1!',
      fan_names[i],
      'https://i.pravatar.cc/300?u=' || fan_usernames[i]
    );
    PERFORM public._dev_seed_upsert_profile(
      uid, fan_usernames[i], fan_names[i],
      'Fan account for local testing.',
      'https://i.pravatar.cc/300?u=' || fan_usernames[i],
      NULL, 150 + (i * 25), false
    );
  END LOOP;

  all_user_ids := creator_ids || fan_ids || ARRAY[dev_admin_id, agency_rival_id];

  -- Subscriptions: each fan follows 3–4 creators
  FOR i IN 1..array_length(fan_ids, 1) LOOP
    FOR j IN 1..LEAST(4, array_length(creator_ids, 1)) LOOP
      cid := creator_ids[1 + ((i + j - 2) % array_length(creator_ids, 1))];
      IF NOT EXISTS (
        SELECT 1 FROM public.subscriptions s
        WHERE s.follower_id = fan_ids[i] AND s.following_id = cid
      ) THEN
        INSERT INTO public.subscriptions (
          follower_id, following_id, status, payment_provider,
          price_at_time_of_subscription_cents, interval_at_time_of_subscription,
          current_period_ends_at
        ) VALUES (
          fan_ids[i], cid, 'active', 'seed',
          499, 'month', timezone('utc', now()) + interval '30 days'
        );
      END IF;
    END LOOP;
    IF i <= 3 AND NOT EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.follower_id = fan_ids[i] AND s.following_id = dev_admin_id
    ) THEN
      INSERT INTO public.subscriptions (
        follower_id, following_id, status, payment_provider,
        price_at_time_of_subscription_cents, interval_at_time_of_subscription,
        current_period_ends_at
      ) VALUES (
        fan_ids[i], dev_admin_id, 'active', 'seed',
        999, 'month', timezone('utc', now()) + interval '30 days'
      );
    END IF;
  END LOOP;

  -- Posts + media per creator (8 each) + Melchor (12)
  FOR i IN 0..array_length(creator_ids, 1) LOOP
    IF i = 0 THEN
      uid := dev_admin_id;
      post_count := 12;
    ELSE
      uid := creator_ids[i];
      post_count := 8;
    END IF;

    FOR post_idx IN 1..post_count LOOP
      post_id := gen_random_uuid();
      days_ago := (i * 3 + post_idx) % 45;

      INSERT INTO public.posts (
        id, user_id, content_type, text_content, tags, category,
        access_level, view_count, like_count, comment_count, bookmark_count,
        created_at, updated_at, metadata, ppv_price_cents
      ) VALUES (
        post_id,
        uid,
        CASE (post_idx % 10)
          WHEN 0 THEN 'short'::public.post_content_type
          WHEN 1 THEN 'video'::public.post_content_type
          WHEN 2 THEN 'live_stream'::public.post_content_type
          WHEN 3 THEN 'carousel'::public.post_content_type
          WHEN 4 THEN 'poll'::public.post_content_type
          WHEN 5 THEN 'text_only'::public.post_content_type
          ELSE 'image'::public.post_content_type
        END,
        post_captions[1 + ((post_idx - 1) % array_length(post_captions, 1))],
        ARRAY['lifestyle', 'creator', 'blabber']::text[],
        CASE WHEN post_idx % 4 = 0 THEN 'fitness' WHEN post_idx % 4 = 1 THEN 'music' ELSE 'daily' END,
        CASE WHEN post_idx % 7 = 0 THEN 'subscribers_only'::public.post_access_level
             WHEN post_idx % 11 = 0 THEN 'ppv'::public.post_access_level
             ELSE 'public'::public.post_access_level END,
        120 + post_idx * 17,
        0, 0, 0,
        timezone('utc', now()) - (days_ago || ' days')::interval,
        timezone('utc', now()) - (days_ago || ' days')::interval,
        CASE WHEN post_idx % 10 = 4 THEN
          '{"type":"POLL","options":[{"id":"a","text":"Option A","order":0},{"id":"b","text":"Option B","order":1},{"id":"c","text":"Option C","order":2}]}'::jsonb
        WHEN post_idx % 10 = 2 THEN
          jsonb_build_object('stream_status', 'ended', 'asset_playback_id', mux_demo)
        ELSE NULL END,
        CASE WHEN post_idx % 11 = 0 THEN 299 ELSE NULL END
      );

      IF post_idx % 10 IN (0, 1, 2) THEN
        INSERT INTO public.post_media (
          post_id, user_id, media_type, mux_playback_id, order_index, width, height
        ) VALUES (
          post_id, uid,
          CASE post_idx % 10 WHEN 0 THEN 'short'::public.media_item_type
               WHEN 2 THEN 'live_stream'::public.media_item_type
               ELSE 'video'::public.media_item_type END,
          mux_demo, 0, 1080, CASE WHEN post_idx % 10 = 0 THEN 1920 ELSE 1080 END
        );
      ELSIF post_idx % 10 = 3 THEN
        INSERT INTO public.post_media (post_id, user_id, media_type, storage_path, order_index, width, height)
        VALUES
          (post_id, uid, 'image', 'https://picsum.photos/seed/' || uid::text || '-' || post_idx || 'a/1080/1350', 0, 1080, 1350),
          (post_id, uid, 'image', 'https://picsum.photos/seed/' || uid::text || '-' || post_idx || 'b/1080/1350', 1, 1080, 1350),
          (post_id, uid, 'image', 'https://picsum.photos/seed/' || uid::text || '-' || post_idx || 'c/1080/1350', 2, 1080, 1350);
      ELSIF post_idx % 10 <> 5 THEN
        INSERT INTO public.post_media (
          post_id, user_id, media_type, storage_path, order_index, width, height
        ) VALUES (
          post_id, uid, 'image',
          'https://picsum.photos/seed/' || uid::text || '-' || post_idx || '/1080/1350',
          0, 1080, 1350
        );
      END IF;

      FOR like_k IN 1..3 LOOP
        INSERT INTO public.user_post_interactions (user_id, post_id, interaction_type)
        VALUES (
          fan_ids[1 + ((like_k + i + post_idx) % array_length(fan_ids, 1))],
          post_id,
          'post_like'
        );
        PERFORM public.increment_like_count(post_id);
      END LOOP;

      IF (i + post_idx) % 5 = 0 THEN
        INSERT INTO public.user_post_interactions (user_id, post_id, interaction_type)
        VALUES (dev_admin_id, post_id, 'post_save');
        PERFORM public.increment_bookmark_count(post_id);
      END IF;

      INSERT INTO public.comments (user_id, post_id, text_content, like_count, created_at)
      VALUES (
        fan_ids[1 + (post_idx % array_length(fan_ids, 1))],
        post_id,
        comment_texts[1 + (post_idx % array_length(comment_texts, 1))],
        post_idx % 4,
        timezone('utc', now()) - (days_ago || ' days')::interval + interval '2 hours'
      );
    END LOOP;
  END LOOP;

  -- Stories (24h) for creators + Melchor
  FOR i IN 1..array_length(creator_ids, 1) LOOP
    uid := creator_ids[i];
    INSERT INTO public.stories (profile_id, media_url, created_at, view_count)
    VALUES
      (uid, 'https://picsum.photos/seed/story-' || i || '-1/1080/1920', timezone('utc', now()) - interval '2 hours', 45 + i),
      (uid, 'https://picsum.photos/seed/story-' || i || '-2/1080/1920', timezone('utc', now()) - interval '5 hours', 30 + i);
  END LOOP;
  INSERT INTO public.stories (profile_id, media_url, created_at, view_count)
  VALUES
    (dev_admin_id, 'https://picsum.photos/seed/story-melchor-1/1080/1920', timezone('utc', now()) - interval '1 hour', 88),
    (dev_admin_id, 'https://picsum.photos/seed/story-melchor-2/1080/1920', timezone('utc', now()) - interval '4 hours', 52);

  -- Story views by Melchor
  INSERT INTO public.user_story_views (viewer_profile_id, story_id)
  SELECT dev_admin_id, s.id FROM public.stories s
  WHERE s.profile_id <> dev_admin_id
  LIMIT 12
  ON CONFLICT (story_id, viewer_profile_id) DO NOTHING;

  -- Marketplace products (2 per creator + melchor)
  FOR i IN 1..array_length(creator_ids, 1) LOOP
    uid := creator_ids[i];
    INSERT INTO public.creator_products (
      creator_profile_id, product_name, description, price_cents, shipping_price_cents,
      main_photo, is_active
    ) VALUES
      (uid, product_names[1], 'Limited edition — ships worldwide.', 3500, 599,
       'https://picsum.photos/seed/product-' || i || '-1/800/800', true),
      (uid, product_names[2], 'Exclusive merch from this month''s drop.', 5500, 799,
       'https://picsum.photos/seed/product-' || i || '-2/800/800', true);
  END LOOP;
  INSERT INTO public.creator_products (
    creator_profile_id, product_name, description, price_cents, shipping_price_cents, main_photo, is_active
  ) VALUES
    (dev_admin_id, 'Vertex Talent Starter Kit', 'Notebook, stickers, and early-access pass.', 2500, 0,
     'https://picsum.photos/seed/product-melchor/800/800', true),
    (dev_admin_id, '1:1 Strategy Call (30 min)', 'Book a focused session with Melchor.', 15000, 0,
     'https://picsum.photos/seed/product-melchor-2/800/800', true);

  -- Financial transactions (admin dashboard / creator dashboard)
  FOR i IN 1..40 LOOP
    days_ago := i % 60;
    uid := fan_ids[1 + (i % array_length(fan_ids, 1))];
    cid := creator_ids[1 + (i % array_length(creator_ids, 1))];
    amt := 500 + (i * 47);
    creator_share := (amt * 80) / 100;
    platform_share := amt - creator_share;
    agency_share := (creator_share * 20) / 100;

    INSERT INTO public.tip_transactions (
      user_id, creator_id, amount_cents, status, payment_provider,
      creator_share_cents, platform_share_cents,
      agency_profile_id, agency_share_cents, created_at
    ) VALUES (
      uid, cid, amt, 'succeeded', 'seed',
      creator_share, platform_share,
      dev_admin_id, agency_share,
      timezone('utc', now()) - (days_ago || ' days')::interval
    );

    INSERT INTO public.credit_transactions (
      user_id, amount_cents, credits_purchased, status, payment_provider, created_at
    ) VALUES (
      uid, 1000 + i * 20, 100 + i, 'succeeded', 'seed',
      timezone('utc', now()) - (days_ago || ' days')::interval
    );

    INSERT INTO public.call_transactions (
      user_id, creator_profile_id, call_length_seconds, credits_used, credits_cents,
      creator_share_cents, platform_share_cents,
      agency_profile_id, agency_share_cents, created_at
    ) VALUES (
      uid, cid, 180 + i * 5, 30 + i, amt,
      creator_share, platform_share,
      dev_admin_id, agency_share,
      timezone('utc', now()) - (days_ago || ' days')::interval
    );
  END LOOP;

  -- Subscription payments
  FOR i IN 1..15 LOOP
    SELECT s.id INTO sub_id
    FROM public.subscriptions s
    WHERE s.status = 'active'
    ORDER BY s.created_at
    OFFSET (i - 1) LIMIT 1;

    IF sub_id IS NOT NULL THEN
      amt := 499 + i * 50;
      creator_share := (amt * 80) / 100;
      platform_share := amt - creator_share;
      SELECT s.following_id, s.follower_id INTO cid, uid FROM public.subscriptions s WHERE s.id = sub_id;

      INSERT INTO public.subscription_payments (
        subscription_id, user_id, creator_profile_id, amount_cents, payment_provider,
        status, period_starts_at, period_ends_at,
        creator_share_cents, platform_share_cents,
        agency_profile_id, agency_share_cents, created_at
      ) VALUES (
        sub_id, uid, cid, amt, 'seed', 'succeeded',
        timezone('utc', now()) - interval '30 days',
        timezone('utc', now()),
        creator_share, platform_share,
        dev_admin_id, (creator_share * 20) / 100,
        timezone('utc', now()) - ((i % 30) || ' days')::interval
      );
    END IF;
  END LOOP;

  -- PPV + product purchases
  FOR i IN 1..12 LOOP
    SELECT p.id, p.user_id INTO post_id, cid
    FROM public.posts p
    WHERE p.access_level = 'ppv'
    ORDER BY p.created_at
    OFFSET (i - 1) LIMIT 1;

    IF post_id IS NOT NULL THEN
      amt := 299;
      creator_share := (amt * 80) / 100;
      platform_share := amt - creator_share;
      uid := fan_ids[1 + (i % array_length(fan_ids, 1))];
      INSERT INTO public.ppv_transactions (
        user_id, post_id, amount_cents, status, payment_provider,
        creator_share_cents, platform_share_cents, created_at
      ) VALUES (
        uid, post_id, amt, 'succeeded', 'seed',
        creator_share, platform_share,
        timezone('utc', now()) - ((i % 20) || ' days')::interval
      );
    END IF;
  END LOOP;

  FOR i IN 1..10 LOOP
    INSERT INTO public.creator_product_transactions (
      user_id, creator_product_id, amount_cents, status, payment_provider,
      creator_share_cents, platform_share_cents,
      agency_profile_id, agency_share_cents, created_at
    )
    SELECT
      fan_ids[1 + (i % array_length(fan_ids, 1))],
      cp.id,
      cp.price_cents,
      'succeeded',
      'seed',
      (cp.price_cents * 80) / 100,
      cp.price_cents - ((cp.price_cents * 80) / 100),
      dev_admin_id,
      ((cp.price_cents * 80) / 100 * 20) / 100,
      timezone('utc', now()) - ((i % 25) || ' days')::interval
    FROM public.creator_products cp
    WHERE cp.creator_profile_id = creator_ids[1 + (i % array_length(creator_ids, 1))]
    LIMIT 1;
  END LOOP;

  -- Chat: Melchor <-> creators + fan threads
  FOR i IN 1..array_length(creator_ids, 1) LOOP
    conv_id := gen_random_uuid();
    INSERT INTO public.conversations (id, is_group, created_at, updated_at)
    VALUES (conv_id, false, timezone('utc', now()) - interval '3 days', timezone('utc', now()));

    INSERT INTO public.conversation_participants (conversation_id, user_id)
    VALUES (conv_id, dev_admin_id), (conv_id, creator_ids[i]);

    msg_id := gen_random_uuid();
    INSERT INTO public.messages (id, conversation_id, sender_id, content, created_at, is_read)
    VALUES (
      msg_id, conv_id, creator_ids[i],
      'Hey Melchor — quick question about this month''s collab schedule.',
      timezone('utc', now()) - interval '2 days', false
    );
    INSERT INTO public.messages (conversation_id, sender_id, content, created_at, is_read)
    VALUES
      (conv_id, dev_admin_id, 'Got it — let''s lock Thursday for the briefing.', timezone('utc', now()) - interval '1 day', true),
      (conv_id, creator_ids[i], 'Perfect. I''ll send the brief tonight.', timezone('utc', now()) - interval '20 hours', false);

    UPDATE public.conversations
    SET last_message_at = timezone('utc', now()) - interval '20 hours',
        last_message_id = (SELECT m.id FROM public.messages m WHERE m.conversation_id = conv_id ORDER BY m.created_at DESC LIMIT 1)
    WHERE id = conv_id;
  END LOOP;

  -- Fan DMs with first creator
  conv_id := gen_random_uuid();
  INSERT INTO public.conversations (id, is_group, created_at, updated_at) VALUES (conv_id, false, timezone('utc', now()) - interval '1 day', timezone('utc', now()));
  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (conv_id, fan_ids[1]), (conv_id, creator_ids[1]);
  INSERT INTO public.messages (conversation_id, sender_id, content, created_at, is_read) VALUES
    (conv_id, fan_ids[1], 'Loved the latest drop — any restocks planned?', timezone('utc', now()) - interval '12 hours', false),
    (conv_id, creator_ids[1], 'Restock next week — I''ll post in stories first.', timezone('utc', now()) - interval '10 hours', true);

  UPDATE public.profiles SET "hasUnreadMsg" = true WHERE id = dev_admin_id;

  -- Notifications for Melchor
  FOR i IN 1..25 LOOP
    cid := creator_ids[1 + (i % array_length(creator_ids, 1))];
    INSERT INTO public.notifications (
      user_id, actor_id, notification_type, title, body, is_read, created_at, data
    ) VALUES (
      dev_admin_id,
      cid,
      (ARRAY['post_like','post_comment','new_subscription','post_tip','product_purchase','subscriber_new_post'])[1 + (i % 6)],
      CASE (i % 6)
        WHEN 0 THEN creator_names[1 + (i % 8)] || ' liked your post'
        WHEN 1 THEN 'New comment on your post'
        WHEN 2 THEN 'New subscriber'
        WHEN 3 THEN 'You received a tip'
        WHEN 4 THEN 'Product purchase'
        ELSE 'New post from someone you follow'
      END,
      'Seed notification #' || i || ' — local dev data for inbox testing.',
      i % 4 = 0,
      timezone('utc', now()) - ((i % 14) || ' hours')::interval,
      jsonb_build_object('seed', true, 'index', i)
    );
  END LOOP;

  RAISE NOTICE 'Dev seed complete: % creators, % fans, admin %.',
    array_length(creator_ids, 1), array_length(fan_ids, 1), dev_admin_email;
END;
$seed$;

DROP FUNCTION IF EXISTS public._dev_seed_auth_user(uuid, text, text, text, text);
DROP FUNCTION IF EXISTS public._dev_seed_upsert_profile(uuid, text, text, text, text, text, integer, boolean);
