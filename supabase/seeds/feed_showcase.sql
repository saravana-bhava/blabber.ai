-- =============================================================================
-- Feed showcase seed — rich post types for For You / Following UI development
-- metadata.seed_pack = 'feed_showcase_v2' on all rows (safe to re-run)
-- =============================================================================

DO $feed$
DECLARE
  mux_demo text := coalesce(
    nullif(current_setting('app.mux_dev_playback_id', true), ''),
    'uNbxnGLKJ00yfbijDO8COxTOyVKT01xpxW'
  );
  pack text := 'feed_showcase_v2';
  dev_admin_id uuid;
  dev_admin_email text := 'admin@blabber.ai';
  c record;
  post_id uuid;
  media_id uuid;
  sub_price_cents int;
  ppv_cents int;
  ppv_credits int;
  thumb text;
  i int := 0;
  captions text[] := ARRAY[
    'Morning routine — full breakdown drops tomorrow for subscribers.',
    'This is the free preview. The full set is on the other side of subscribe.',
    'Three years of consistency. Grateful for everyone still here.',
    'New studio session. Wait until you hear the final mix.',
    'Quick tip that saved me hours this week.',
    'Behind the scenes from yesterday''s shoot — more coming soon.',
    'Ask me anything in the comments tonight.',
    'Dropping something special at 8pm ET.'
  ];
BEGIN
  SELECT id INTO dev_admin_id FROM auth.users WHERE email = dev_admin_email LIMIT 1;

  -- Remove prior showcase posts (cascade media via FK)
  DELETE FROM public.posts WHERE metadata->>'seed_pack' = pack;

  FOR c IN
    SELECT
      cr.profile_id,
      p.username,
      p.full_name,
      cr.subscription_price_cents,
      row_number() OVER (ORDER BY cr.profile_id) AS rn
    FROM public.creators cr
    JOIN public.profiles p ON p.id = cr.profile_id
    WHERE cr.can_monetize = true
    ORDER BY cr.profile_id
    LIMIT 8
  LOOP
    sub_price_cents := coalesce(nullif(c.subscription_price_cents, 0), 999);
    thumb := 'https://image.mux.com/' || mux_demo || '/thumbnail.jpg?time=2&width=720&height=1280&fit_mode=smartcrop';
    i := c.rn;

    -- -----------------------------------------------------------------------
    -- 1. Normal: text post
    -- -----------------------------------------------------------------------
    post_id := gen_random_uuid();
    INSERT INTO public.posts (
      id, user_id, content_type, text_content, tags, access_level,
      view_count, like_count, comment_count, bookmark_count, share_count,
      created_at, updated_at, metadata
    ) VALUES (
      post_id, c.profile_id, 'text_only',
      captions[1 + (i % array_length(captions, 1))],
      ARRAY['daily', 'creator']::text[], 'public',
      420 + i * 3, 18 + i, 4 + (i % 3), 2, 1,
      timezone('utc', now()) - ((i * 2 + 1) || ' hours')::interval,
      timezone('utc', now()) - ((i * 2 + 1) || ' hours')::interval,
      jsonb_build_object(
        'seed_pack', pack,
        'feed_item_type', 'post',
        'type', 'text',
        'stats', jsonb_build_object('likes', 18 + i, 'comments', 4, 'bookmarks', 2, 'shares', 1, 'views', 420 + i * 3),
        'viewer_state', jsonb_build_object('has_liked', false, 'has_bookmarked', false, 'has_unlocked', true)
      )
    );

    -- -----------------------------------------------------------------------
    -- 1. Normal: portrait image
    -- -----------------------------------------------------------------------
    post_id := gen_random_uuid();
    INSERT INTO public.posts (
      id, user_id, content_type, text_content, tags, access_level,
      view_count, like_count, comment_count, bookmark_count,
      created_at, updated_at, metadata
    ) VALUES (
      post_id, c.profile_id, 'image',
      'Golden hour in the city — no filter, no rush.',
      ARRAY['photo', 'lifestyle']::text[], 'public',
      890 + i * 5, 64 + i, 9, 11,
      timezone('utc', now()) - ((i * 3 + 2) || ' hours')::interval,
      timezone('utc', now()) - ((i * 3 + 2) || ' hours')::interval,
      jsonb_build_object(
        'seed_pack', pack,
        'feed_item_type', 'post',
        'type', 'image',
        'stats', jsonb_build_object('likes', 64 + i, 'comments', 9, 'bookmarks', 11, 'views', 890 + i * 5)
      )
    );
    INSERT INTO public.post_media (
      post_id, user_id, media_type, storage_path, order_index, width, height, metadata
    ) VALUES (
      post_id, c.profile_id, 'image',
      'https://picsum.photos/seed/' || c.username || '-portrait-' || i || '/1080/1440',
      0, 1080, 1440,
      jsonb_build_object(
        'thumbnail_url', 'https://picsum.photos/seed/' || c.username || '-portrait-' || i || '/400/533',
        'image_url', 'https://picsum.photos/seed/' || c.username || '-portrait-' || i || '/1080/1440',
        'aspect_ratio', round((1440.0 / 1080.0) * 100) / 100,
        'blur_data_url', 'https://picsum.photos/seed/' || c.username || '-blur-' || i || '/20/27'
      )
    );

    -- -----------------------------------------------------------------------
    -- 1. Normal: landscape image
    -- -----------------------------------------------------------------------
    post_id := gen_random_uuid();
    INSERT INTO public.posts (
      id, user_id, content_type, text_content, access_level,
      view_count, like_count, comment_count, bookmark_count,
      created_at, updated_at, metadata
    ) VALUES (
      post_id, c.profile_id, 'image',
      'Weekend road trip — first frame from the series.',
      'public', 560 + i, 31 + i, 5, 7,
      timezone('utc', now()) - ((i * 4 + 3) || ' hours')::interval,
      timezone('utc', now()) - ((i * 4 + 3) || ' hours')::interval,
      jsonb_build_object('seed_pack', pack, 'feed_item_type', 'post', 'type', 'image')
    );
    INSERT INTO public.post_media (
      post_id, user_id, media_type, storage_path, order_index, width, height, metadata
    ) VALUES (
      post_id, c.profile_id, 'image',
      'https://picsum.photos/seed/' || c.username || '-landscape-' || i || '/1440/810',
      0, 1440, 810,
      jsonb_build_object(
        'thumbnail_url', 'https://picsum.photos/seed/' || c.username || '-landscape-' || i || '/640/360',
        'aspect_ratio', 56.25
      )
    );

    -- -----------------------------------------------------------------------
    -- 5. Video post (first-class)
    -- -----------------------------------------------------------------------
    post_id := gen_random_uuid();
    INSERT INTO public.posts (
      id, user_id, content_type, text_content, access_level,
      view_count, like_count, comment_count, bookmark_count,
      created_at, updated_at, metadata
    ) VALUES (
      post_id, c.profile_id, 'video',
      'Full walkthrough — save this if you''re building something similar.',
      'public', 1200 + i * 8, 88 + i, 14, 19,
      timezone('utc', now()) - ((i + 1) || ' hours')::interval,
      timezone('utc', now()) - ((i + 1) || ' hours')::interval,
      jsonb_build_object(
        'seed_pack', pack,
        'feed_item_type', 'post',
        'type', 'video',
        'stats', jsonb_build_object('likes', 88 + i, 'comments', 14, 'views', 1200 + i * 8)
      )
    );
    INSERT INTO public.post_media (
      post_id, user_id, media_type, mux_playback_id, order_index, width, height, metadata
    ) VALUES (
      post_id, c.profile_id, 'video', mux_demo, 0, 1920, 1080,
      jsonb_build_object(
        'media_type', 'video',
        'mux_playback_id', mux_demo,
        'thumbnail_url', thumb,
        'duration_seconds', 142 + (i % 40),
        'aspect_ratio', 56.25,
        'watch_progress_seconds', CASE WHEN i % 3 = 0 THEN 45 ELSE 0 END
      )
    );

    -- -----------------------------------------------------------------------
    -- 1. Normal: poll
    -- -----------------------------------------------------------------------
    post_id := gen_random_uuid();
    INSERT INTO public.posts (
      id, user_id, content_type, text_content, access_level,
      view_count, like_count, comment_count,
      created_at, updated_at, metadata
    ) VALUES (
      post_id, c.profile_id, 'poll',
      'What should I post next?',
      'public', 310 + i, 22 + i, 31,
      timezone('utc', now()) - ((i * 5 + 4) || ' hours')::interval,
      timezone('utc', now()) - ((i * 5 + 4) || ' hours')::interval,
      jsonb_build_object(
        'seed_pack', pack,
        'feed_item_type', 'post',
        'type', 'poll',
        'type_poll', 'POLL',
        'options', jsonb_build_array(
          jsonb_build_object('id', 'a', 'text', 'Tutorial', 'order', 0),
          jsonb_build_object('id', 'b', 'text', 'Q&A live', 'order', 1),
          jsonb_build_object('id', 'c', 'text', 'Behind the scenes', 'order', 2)
        )
      )
    );

    -- -----------------------------------------------------------------------
    -- 2. Public teaser → subscription
    -- -----------------------------------------------------------------------
    post_id := gen_random_uuid();
    INSERT INTO public.posts (
      id, user_id, content_type, text_content, access_level,
      view_count, like_count, comment_count,
      created_at, updated_at, metadata
    ) VALUES (
      post_id, c.profile_id, 'image',
      'Free preview from this week''s subscriber drop. Full gallery inside.',
      'public', 2400 + i, 120 + i, 28,
      timezone('utc', now()) - ((i * 2) || ' hours')::interval,
      timezone('utc', now()) - ((i * 2) || ' hours')::interval,
      jsonb_build_object(
        'seed_pack', pack,
        'feed_item_type', 'teaser',
        'access_level', 'public',
        'teaser_for', 'subscription',
        'cta', jsonb_build_object('label', 'Subscribe', 'target_id', c.profile_id::text),
        'value_message', 'Subscribe to see more'
      )
    );
    INSERT INTO public.post_media (post_id, user_id, media_type, storage_path, order_index, width, height)
    VALUES (
      post_id, c.profile_id, 'image',
      'https://picsum.photos/seed/' || c.username || '-teaser-sub-' || i || '/1080/1350',
      0, 1080, 1350
    );

    -- -----------------------------------------------------------------------
    -- 2. Public teaser → PPV
    -- -----------------------------------------------------------------------
    IF i <= 4 THEN
      post_id := gen_random_uuid();
      INSERT INTO public.posts (
        id, user_id, content_type, text_content, access_level,
        view_count, like_count, created_at, updated_at, metadata
      ) VALUES (
        post_id, c.profile_id, 'image',
        'Sneak peek — full set unlocks for credits. Worth it.',
        'public', 1800 + i, 95 + i,
        timezone('utc', now()) - ((i + 3) || ' hours')::interval,
        timezone('utc', now()) - ((i + 3) || ' hours')::interval,
        jsonb_build_object(
          'seed_pack', pack,
          'feed_item_type', 'teaser',
          'teaser_for', 'ppv',
          'cta', jsonb_build_object('label', 'Unlock', 'target_id', c.profile_id::text)
        )
      );
      INSERT INTO public.post_media (post_id, user_id, media_type, storage_path, order_index, width, height)
      VALUES (post_id, c.profile_id, 'image', 'https://picsum.photos/seed/' || c.username || '-teaser-ppv-' || i || '/1080/1350', 0, 1080, 1350);
    END IF;

    -- -----------------------------------------------------------------------
    -- 3. Subscriber-only locked
    -- -----------------------------------------------------------------------
    post_id := gen_random_uuid();
    INSERT INTO public.posts (
      id, user_id, content_type, text_content, access_level,
      view_count, like_count, comment_count,
      created_at, updated_at, metadata
    ) VALUES (
      post_id, c.profile_id, 'image',
      'Subscriber exclusive — extended cut and full resolution.',
      'subscribers_only', 640 + i, 41 + i, 8,
      timezone('utc', now()) - ((i * 6 + 5) || ' hours')::interval,
      timezone('utc', now()) - ((i * 6 + 5) || ' hours')::interval,
      jsonb_build_object(
        'seed_pack', pack,
        'feed_item_type', 'post',
        'access_level', 'subscribers',
        'is_locked', true,
        'subscription_price', sub_price_cents,
        'preview_thumbnail_url', 'https://picsum.photos/seed/' || c.username || '-sub-lock-' || i || '/400/500',
        'unlock_context', jsonb_build_object(
          'total_subscriber_posts', 32 + i * 2,
          'recent_subscriber_posts', 6 + (i % 4)
        ),
        'value_message', format(
          'Subscribe for $%s/month to unlock %s posts',
          (sub_price_cents::numeric / 100)::text,
          (32 + i * 2)::text
        )
      )
    );
    INSERT INTO public.post_media (
      post_id, user_id, media_type, storage_path, blurred_storage_path, order_index, width, height
    ) VALUES (
      post_id, c.profile_id, 'image',
      'https://picsum.photos/seed/' || c.username || '-sub-full-' || i || '/1080/1350',
      'https://picsum.photos/seed/' || c.username || '-sub-lock-' || i || '/400/500',
      0, 1080, 1350
    );

    -- -----------------------------------------------------------------------
    -- 4. PPV locked
    -- -----------------------------------------------------------------------
    ppv_cents := 299 + (i * 100);
    ppv_credits := ceil(ppv_cents::numeric / 5.0)::integer;
    post_id := gen_random_uuid();
    INSERT INTO public.posts (
      id, user_id, content_type, text_content, access_level, ppv_price_cents,
      view_count, like_count, comment_count,
      created_at, updated_at, metadata
    ) VALUES (
      post_id, c.profile_id, 'video',
      'Premium tutorial — one-time unlock or subscribe for everything.',
      'ppv', ppv_cents,
      980 + i, 52 + i, 11,
      timezone('utc', now()) - ((i * 7 + 2) || ' hours')::interval,
      timezone('utc', now()) - ((i * 7 + 2) || ' hours')::interval,
      jsonb_build_object(
        'seed_pack', pack,
        'feed_item_type', 'post',
        'access_level', 'ppv',
        'ppv_price_credits', ppv_credits,
        'has_unlocked', false,
        'preview_available', true,
        'cta_alternative', jsonb_build_object('label', 'Subscribe', 'target_id', c.profile_id::text)
      )
    );
    INSERT INTO public.post_media (
      post_id, user_id, media_type, mux_playback_id, blurred_storage_path, order_index, width, height, metadata
    ) VALUES (
      post_id, c.profile_id, 'video', mux_demo,
      'https://picsum.photos/seed/' || c.username || '-ppv-blur-' || i || '/640/360',
      0, 1920, 1080,
      jsonb_build_object('thumbnail_url', thumb, 'duration_seconds', 240)
    );

    -- -----------------------------------------------------------------------
    -- 7. Short preview card (image shell — not content_type short, stays in For You)
    -- -----------------------------------------------------------------------
    post_id := gen_random_uuid();
    INSERT INTO public.posts (
      id, user_id, content_type, text_content, access_level,
      view_count, like_count,
      created_at, updated_at, metadata
    ) VALUES (
      post_id, c.profile_id, 'image',
      'New short — tap to watch',
      'public', 3200 + i, 210 + i,
      timezone('utc', now()) - ((i % 3) || ' hours')::interval,
      timezone('utc', now()) - ((i % 3) || ' hours')::interval,
      jsonb_build_object(
        'seed_pack', pack,
        'feed_item_type', 'short_preview',
        'type', 'short_preview',
        'short_id', post_id::text,
        'thumbnail_url', thumb,
        'duration_seconds', 28 + (i % 15),
        'creator_summary', jsonb_build_object(
          'id', c.profile_id,
          'username', c.username,
          'display_name', c.full_name
        )
      )
    );
    INSERT INTO public.post_media (
      post_id, user_id, media_type, mux_playback_id, order_index, width, height, metadata
    ) VALUES (
      post_id, c.profile_id, 'short', mux_demo, 0, 1080, 1920,
      jsonb_build_object('thumbnail_url', thumb, 'duration_seconds', 28 + (i % 15))
    );

    -- -----------------------------------------------------------------------
    -- 8. Live card (active) — first 4 creators
    -- -----------------------------------------------------------------------
    IF i <= 4 THEN
      post_id := gen_random_uuid();
      INSERT INTO public.posts (
        id, user_id, content_type, text_content, access_level,
        view_count, like_count,
        created_at, updated_at, metadata
      ) VALUES (
        post_id, c.profile_id, 'live_stream',
        coalesce(c.full_name, c.username) || ' is live — Q&A and new drops',
        CASE WHEN i % 2 = 0 THEN 'public'::public.post_access_level ELSE 'subscribers_only'::public.post_access_level END,
        180 + i * 40, 12 + i,
        timezone('utc', now()) - ((i * 8) || ' minutes')::interval,
        timezone('utc', now()) - ((i * 8) || ' minutes')::interval,
        jsonb_build_object(
          'seed_pack', pack,
          'feed_item_type', 'live_card',
          'type', 'live_card',
          'live_id', post_id::text,
          'title', 'Live now — come hang',
          'viewer_count', 120 + i * 37,
          'started_at', (timezone('utc', now()) - ((i * 8) || ' minutes')::interval)::text,
          'stream_status', 'live',
          'asset_playback_id', mux_demo,
          'access_level', CASE WHEN i % 2 = 0 THEN 'public' ELSE 'subscribers' END,
          'cta', jsonb_build_object('label', 'Join Live', 'target_id', post_id::text),
          'creator_summary', jsonb_build_object(
            'id', c.profile_id,
            'username', c.username,
            'display_name', c.full_name
          )
        )
      );
      INSERT INTO public.post_media (
        post_id, user_id, media_type, mux_playback_id, order_index, width, height, metadata
      ) VALUES (
        post_id, c.profile_id, 'live_stream', mux_demo, 0, 1080, 1080,
        jsonb_build_object('thumbnail_url', thumb, 'status', 'live')
      );
    END IF;

    -- Teaser → store (creator product)
    IF i = 1 THEN
      post_id := gen_random_uuid();
      INSERT INTO public.posts (
        id, user_id, content_type, text_content, access_level,
        created_at, updated_at, metadata
      ) VALUES (
        post_id, c.profile_id, 'image',
        'Merch drop preview — full catalog in the store.',
        'public',
        timezone('utc', now()) - interval '30 minutes',
        timezone('utc', now()) - interval '30 minutes',
        jsonb_build_object(
          'seed_pack', pack,
          'feed_item_type', 'teaser',
          'teaser_for', 'store',
          'cta', jsonb_build_object('label', 'View Store', 'target_id', c.profile_id::text)
        )
      );
      INSERT INTO public.post_media (post_id, user_id, media_type, storage_path, order_index, width, height)
      VALUES (post_id, c.profile_id, 'image', 'https://picsum.photos/seed/' || c.username || '-store-teaser/800/800', 0, 800, 800);
    END IF;

    -- Teaser → live
    IF i = 2 THEN
      post_id := gen_random_uuid();
      INSERT INTO public.posts (
        id, user_id, content_type, text_content, access_level,
        created_at, updated_at, metadata
      ) VALUES (
        post_id, c.profile_id, 'image',
        'Going live in 10 minutes — turn notifications on.',
        'public',
        timezone('utc', now()) - interval '20 minutes',
        timezone('utc', now()) - interval '20 minutes',
        jsonb_build_object(
          'seed_pack', pack,
          'feed_item_type', 'teaser',
          'teaser_for', 'live',
          'cta', jsonb_build_object('label', 'Join Live', 'target_id', c.profile_id::text)
        )
      );
      INSERT INTO public.post_media (post_id, user_id, media_type, storage_path, order_index, width, height)
      VALUES (post_id, c.profile_id, 'image', 'https://picsum.photos/seed/' || c.username || '-live-teaser/1080/608', 0, 1080, 608);
    END IF;

  END LOOP;

  -- Admin engagement on showcase posts
  IF dev_admin_id IS NOT NULL THEN
  FOR c IN
    SELECT p.id AS pid FROM public.posts p
    WHERE p.metadata->>'seed_pack' = pack
    ORDER BY p.created_at DESC
    LIMIT 12
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.user_post_interactions upi
      WHERE upi.user_id = dev_admin_id AND upi.post_id = c.pid AND upi.interaction_type = 'post_like'
    ) THEN
      INSERT INTO public.user_post_interactions (user_id, post_id, interaction_type)
      VALUES (dev_admin_id, c.pid, 'post_like');
      PERFORM public.increment_like_count(c.pid);
    END IF;
  END LOOP;

  FOR c IN
    SELECT p.id AS pid FROM public.posts p
    WHERE p.metadata->>'seed_pack' = pack AND p.access_level = 'public'
    ORDER BY random()
    LIMIT 6
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.user_post_interactions upi
      WHERE upi.user_id = dev_admin_id AND upi.post_id = c.pid AND upi.interaction_type = 'post_save'
    ) THEN
      INSERT INTO public.user_post_interactions (user_id, post_id, interaction_type)
      VALUES (dev_admin_id, c.pid, 'post_save');
      PERFORM public.increment_bookmark_count(c.pid);
    END IF;
  END LOOP;
  END IF;

  RAISE NOTICE 'Feed showcase seed: % posts for pack %',
    (SELECT count(*) FROM public.posts WHERE metadata->>'seed_pack' = pack), pack;
END;
$feed$;
