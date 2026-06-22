-- Ensures home tabs have data (runs on every db:seed / db reset).
-- Safe to re-run: idempotent inserts and timestamp refresh.

DO $home$
DECLARE
  dev_admin_id uuid;
  dev_admin_email text := 'admin@blabber.ai';
  -- Mux docs public demo asset (https://www.mux.com/docs/guides/play-your-videos)
  mux_demo text := 'uNbxnGLKJ00yfbijDO8COxTOyVKT01xpxW';
  creator_row record;
  post_id uuid;
  short_captions text[] := ARRAY[
    'POV: you finally hit publish',
    '60 seconds of pure chaos',
    'Wait for it…',
    'This trend but make it mine',
    'Day in my life — no filter',
    'Tutorial speedrun edition',
    'When the audio hits just right',
    'Replying to your DMs with a short',
    'Behind the scenes (literally)',
    'One take. No notes.'
  ];
  i int;
  existing_shorts int;
BEGIN
  SELECT id INTO dev_admin_id FROM auth.users WHERE email = dev_admin_email LIMIT 1;
  IF dev_admin_id IS NULL THEN
    RAISE NOTICE 'home_feed_patch: skip (no % — run seed.sql first)', dev_admin_email;
    RETURN;
  END IF;

  -- Admin follows every creator (+ self posts show on profile, not following feed)
  FOR creator_row IN
    SELECT c.profile_id
    FROM public.creators c
    WHERE c.profile_id <> dev_admin_id
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.follower_id = dev_admin_id AND s.following_id = creator_row.profile_id
    ) THEN
      INSERT INTO public.subscriptions (
        follower_id, following_id, status, payment_provider,
        price_at_time_of_subscription_cents, interval_at_time_of_subscription,
        current_period_ends_at
      ) VALUES (
        dev_admin_id, creator_row.profile_id, 'active', 'seed',
        999, 'month', timezone('utc', now()) + interval '30 days'
      );
    END IF;
  END LOOP;

  SELECT count(*)::int INTO existing_shorts FROM public.posts WHERE content_type = 'short';

  IF existing_shorts < 24 THEN
    FOR creator_row IN
      SELECT c.profile_id
      FROM public.creators c
      ORDER BY c.profile_id
    LOOP
      FOR i IN 1..3 LOOP
        EXIT WHEN existing_shorts >= 24;
        post_id := gen_random_uuid();
        INSERT INTO public.posts (
          id, user_id, content_type, text_content, tags, access_level,
          view_count, like_count, comment_count, bookmark_count, created_at, updated_at
        ) VALUES (
          post_id,
          creator_row.profile_id,
          'short',
          short_captions[1 + (existing_shorts % array_length(short_captions, 1))],
          ARRAY['shorts', 'fyp']::text[],
          'public',
          200 + existing_shorts * 11,
          0, 0, 0,
          timezone('utc', now()) - ((existing_shorts + 1) || ' hours')::interval,
          timezone('utc', now()) - ((existing_shorts + 1) || ' hours')::interval
        );
        INSERT INTO public.post_media (
          post_id, user_id, media_type, mux_playback_id, order_index, width, height
        ) VALUES (
          post_id, creator_row.profile_id, 'short', mux_demo, 0, 1080, 1920
        );
        existing_shorts := existing_shorts + 1;
      END LOOP;
    END LOOP;
  END IF;

  -- Keep stories in the 24h live window
  UPDATE public.stories
  SET created_at = timezone('utc', now()) - (random() * interval '18 hours')
  WHERE created_at < timezone('utc', now()) - interval '24 hours'
     OR created_at IS NULL;

  -- Extra live stream posts if sparse
  IF (SELECT count(*) FROM public.posts WHERE content_type = 'live_stream') < 15 THEN
    FOR creator_row IN
      SELECT c.profile_id FROM public.creators c LIMIT 6
    LOOP
      post_id := gen_random_uuid();
      INSERT INTO public.posts (
        id, user_id, content_type, text_content, tags, access_level,
        view_count, like_count, comment_count, bookmark_count,
        created_at, updated_at, metadata
      ) VALUES (
        post_id, creator_row.profile_id, 'live_stream',
        'Replay: last night''s stream — thanks everyone who pulled up.',
        ARRAY['live', 'replay']::text[], 'public',
        340, 0, 0, 0,
        timezone('utc', now()) - interval '6 hours',
        timezone('utc', now()) - interval '6 hours',
        jsonb_build_object('stream_status', 'ended', 'asset_playback_id', mux_demo)
      );
      INSERT INTO public.post_media (
        post_id, user_id, media_type, mux_playback_id, order_index, width, height
      ) VALUES (
        post_id, creator_row.profile_id, 'live_stream', mux_demo, 0, 1080, 1080
      );
    END LOOP;
  END IF;

  -- Fix invalid seed playback IDs (Mux player shows "Video does not exist")
  UPDATE public.post_media
  SET mux_playback_id = mux_demo
  WHERE mux_playback_id IS NOT NULL
    AND mux_playback_id <> mux_demo;

  -- Stale post.metadata.asset_playback_id overrides the column in the player
  UPDATE public.posts p
  SET metadata = coalesce(p.metadata, '{}'::jsonb) || jsonb_build_object('asset_playback_id', mux_demo)
  WHERE p.content_type = 'live_stream'
    AND (
      p.metadata->>'asset_playback_id' IS NULL
      OR p.metadata->>'asset_playback_id' <> mux_demo
    );

  -- Mark recent live_stream posts as "live" for Live tab badges (replay still plays via Mux VOD)
  UPDATE public.posts p
  SET
    metadata = coalesce(p.metadata, '{}'::jsonb) || '{"stream_status":"live"}'::jsonb,
    created_at = timezone('utc', now()) - (random() * interval '45 minutes'),
    updated_at = timezone('utc', now())
  WHERE p.content_type = 'live_stream'
    AND p.id IN (
      SELECT id FROM public.posts
      WHERE content_type = 'live_stream'
      ORDER BY created_at DESC
      LIMIT 6
    );

  -- Carousel slides from feed_scroll_volume_v1 used picsum || '-a' after dimensions (404 URLs)
  UPDATE public.post_media pm
  SET
    storage_path = regexp_replace(
      pm.storage_path,
      '^https://picsum\.photos/seed/(vol-[^/]+)/([0-9]+)/([0-9]+)-([abc])$',
      'https://picsum.photos/seed/\1-\4/\2/\3'
    ),
    metadata = CASE
      WHEN pm.metadata ? 'thumbnail_url' THEN
        jsonb_set(
          pm.metadata,
          '{thumbnail_url}',
          to_jsonb(
            regexp_replace(
              pm.metadata->>'thumbnail_url',
              '^https://picsum\.photos/seed/(vol-[^/]+)/([0-9]+)/([0-9]+)-([abc])$',
              'https://picsum.photos/seed/\1-\4/\2/\3'
            )
          )
        )
      ELSE pm.metadata
    END
  WHERE pm.storage_path ~ '^https://picsum\.photos/seed/vol-[^/]+/[0-9]+/[0-9]+-[abc]$';

  RAISE NOTICE 'Home feed patch: subs, shorts, stories, live, Mux playback IDs updated.';
END;
$home$;
