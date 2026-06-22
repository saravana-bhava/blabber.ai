-- =============================================================================
-- Feed scroll volume — many posts + varied media dimensions for infinite scroll UX
-- metadata.seed_pack = 'feed_scroll_volume_v1' (idempotent re-run)
-- =============================================================================

DO $vol$
DECLARE
  mux_demo text := 'uNbxnGLKJ00yfbijDO8COxTOyVKT01xpxW';
  pack text := 'feed_scroll_volume_v1';
  creator_ids uuid[];
  creator_names text[];
  creator_usernames text[];

  -- Dimension presets (width x height) for layout testing
  dim_w int[] := ARRAY[1080, 1080, 1080, 1920, 2560, 720, 1200, 800, 1440, 1080, 1920, 540];
  dim_h int[] := ARRAY[1920, 1350, 1080, 1080, 1080, 1280, 1600, 1200, 810, 1920, 1280, 960];
  dim_label text[] := ARRAY[
    '9:16', '4:5', '1:1', '16:9', '21:9', '9:16-narrow', '3:4', '2:3',
    '16:9-wide', '9:16-tall', '3:2', '9:8'
  ];

  n int;
  total int := 220;
  cid uuid;
  cname text;
  cuser text;
  post_id uuid;
  w int;
  h int;
  dl text;
  thumb text;
  pct text;
  kind int;
  hours_ago int;
  picsum text;
  picsum_seed text;
  aspect numeric;
  i int;
BEGIN
  DELETE FROM public.posts WHERE metadata->>'seed_pack' = pack;

  SELECT
    array_agg(cr.profile_id ORDER BY cr.profile_id),
    array_agg(p.full_name ORDER BY cr.profile_id),
    array_agg(p.username ORDER BY cr.profile_id)
  INTO creator_ids, creator_names, creator_usernames
  FROM public.creators cr
  JOIN public.profiles p ON p.id = cr.profile_id
  WHERE cr.can_monetize = true;

  IF creator_ids IS NULL OR array_length(creator_ids, 1) < 1 THEN
    RAISE NOTICE 'feed_scroll_volume: no creators — skip';
    RETURN;
  END IF;

  FOR n IN 1..total LOOP
    i := 1 + ((n - 1) % array_length(creator_ids, 1));
    cid := creator_ids[i];
    cname := creator_names[i];
    cuser := creator_usernames[i];

    w := dim_w[1 + ((n - 1) % array_length(dim_w, 1))];
    h := dim_h[1 + ((n - 1) % array_length(dim_h, 1))];
    dl := dim_label[1 + ((n - 1) % array_length(dim_label, 1))];
    aspect := round((h::numeric / greatest(w, 1)::numeric) * 10000) / 100;
    hours_ago := (n % 336); -- spread over ~14 days
    post_id := gen_random_uuid();
    thumb := 'https://image.mux.com/' || mux_demo || '/thumbnail.jpg?time=' || (n % 30) || '&width=' || least(w, 640) || '&height=' || least(h, 640);
    picsum := 'https://picsum.photos/seed/vol-' || cuser || '-' || n || '/' || w || '/' || h;
    picsum_seed := 'vol-' || cuser || '-' || n;

    -- 0-5 image, 6-8 video, 9 live, 10 text, 11 poll, 12 carousel, 13 sub-lock, 14 ppv, 15 teaser, 16 short_preview, 17 live_card
    kind := n % 18;

    CASE kind
      WHEN 0, 1, 2, 3, 4, 5 THEN
        pct := CASE (n % 5)
          WHEN 0 THEN 'image'
          WHEN 1 THEN 'image'
          WHEN 2 THEN 'carousel'
          ELSE 'image'
        END;
        INSERT INTO public.posts (
          id, user_id, content_type, text_content, tags, access_level, ppv_price_cents,
          view_count, like_count, comment_count, bookmark_count, share_count,
          created_at, updated_at, metadata
        ) VALUES (
          post_id, cid,
          pct::public.post_content_type,
          format('[%s %sx%s] %s — scroll test post #%s', dl, w, h, cname, n),
          ARRAY['scroll-test', dl, 'feed']::text[],
          CASE WHEN n % 17 = 0 THEN 'subscribers_only'::public.post_access_level
               WHEN n % 23 = 0 THEN 'ppv'::public.post_access_level
               ELSE 'public'::public.post_access_level END,
          CASE WHEN n % 23 = 0 THEN 399 + (n % 500) ELSE NULL END,
          80 + (n * 13) % 5000,
          5 + (n % 120),
          (n % 25),
          (n % 15),
          (n % 8),
          timezone('utc', now()) - (hours_ago || ' hours')::interval,
          timezone('utc', now()) - (hours_ago || ' hours')::interval,
          jsonb_build_object(
            'seed_pack', pack,
            'feed_item_type', 'post',
            'type', 'image',
            'dimension_label', dl,
            'width', w,
            'height', h,
            'aspect_ratio', aspect,
            'stats', jsonb_build_object('views', 80 + (n * 13) % 5000, 'likes', 5 + (n % 120))
          )
        );
        IF pct = 'carousel' THEN
          INSERT INTO public.post_media (post_id, user_id, media_type, storage_path, order_index, width, height, metadata)
          VALUES
            (post_id, cid, 'image',
             'https://picsum.photos/seed/' || picsum_seed || '-a/' || w || '/' || h, 0, w, h,
             jsonb_build_object(
               'thumbnail_url', 'https://picsum.photos/seed/' || picsum_seed || '-a/' || w || '/' || h,
               'aspect_ratio', aspect, 'dimension_label', dl)),
            (post_id, cid, 'image',
             'https://picsum.photos/seed/' || picsum_seed || '-b/' || w || '/' || h, 1, w, h,
             jsonb_build_object(
               'thumbnail_url', 'https://picsum.photos/seed/' || picsum_seed || '-b/' || w || '/' || h,
               'aspect_ratio', aspect)),
            (post_id, cid, 'image',
             'https://picsum.photos/seed/' || picsum_seed || '-c/' || w || '/' || h, 2, w, h,
             jsonb_build_object(
               'thumbnail_url', 'https://picsum.photos/seed/' || picsum_seed || '-c/' || w || '/' || h,
               'aspect_ratio', aspect));
        ELSE
          INSERT INTO public.post_media (
            post_id, user_id, media_type, storage_path, order_index, width, height, metadata
          ) VALUES (
            post_id, cid, 'image', picsum, 0, w, h,
            jsonb_build_object(
              'media_type', 'image',
              'image_url', picsum,
              'thumbnail_url', picsum,
              'width', w,
              'height', h,
              'aspect_ratio', aspect,
              'dimension_label', dl
            )
          );
        END IF;
      WHEN 6, 7, 8 THEN
        INSERT INTO public.posts (
          id, user_id, content_type, text_content, tags, access_level,
          view_count, like_count, comment_count, bookmark_count,
          created_at, updated_at, metadata
        ) VALUES (
          post_id, cid, 'video',
          format('[%s video %sx%s] Walkthrough #%s — muted autoplay test', dl, w, h, n),
          ARRAY['video', dl]::text[], 'public',
          200 + (n * 17) % 8000,
          12 + (n % 90),
          (n % 18),
          (n % 12),
          timezone('utc', now()) - (hours_ago || ' hours')::interval,
          timezone('utc', now()) - (hours_ago || ' hours')::interval,
          jsonb_build_object(
            'seed_pack', pack,
            'feed_item_type', 'post',
            'type', 'video',
            'dimension_label', dl,
            'width', w,
            'height', h,
            'aspect_ratio', aspect
          )
        );
        INSERT INTO public.post_media (
          post_id, user_id, media_type, mux_playback_id, order_index, width, height, metadata
        ) VALUES (
          post_id, cid, 'video', mux_demo, 0, w, h,
          jsonb_build_object(
            'media_type', 'video',
            'mux_playback_id', mux_demo,
            'thumbnail_url', thumb,
            'duration_seconds', 30 + (n % 600),
            'width', w,
            'height', h,
            'aspect_ratio', aspect,
            'dimension_label', dl,
            'watch_progress_seconds', CASE WHEN n % 4 = 0 THEN (n % 60) ELSE 0 END
          )
        );

      WHEN 9, 17 THEN
        INSERT INTO public.posts (
          id, user_id, content_type, text_content, tags, access_level,
          view_count, like_count,
          created_at, updated_at, metadata
        ) VALUES (
          post_id, cid, 'live_stream',
          format('[%s live %sx%s] %s', dl, w, h, cname),
          ARRAY['live', dl]::text[],
          CASE WHEN n % 5 = 0 THEN 'subscribers_only'::public.post_access_level ELSE 'public'::public.post_access_level END,
          150 + (n * 11) % 3000,
          8 + (n % 40),
          timezone('utc', now()) - (least(hours_ago, 120) || ' minutes')::interval,
          timezone('utc', now()) - (least(hours_ago, 120) || ' minutes')::interval,
          jsonb_build_object(
            'seed_pack', pack,
            'feed_item_type', CASE WHEN kind = 17 THEN 'live_card' ELSE 'post' END,
            'type', 'live_card',
            'stream_status', CASE WHEN n % 3 = 0 THEN 'live' ELSE 'ended' END,
            'title', 'Live · ' || dl,
            'viewer_count', 50 + (n % 800),
            'dimension_label', dl,
            'width', w,
            'height', h,
            'aspect_ratio', aspect,
            'asset_playback_id', mux_demo
          )
        );
        INSERT INTO public.post_media (
          post_id, user_id, media_type, mux_playback_id, order_index, width, height, metadata
        ) VALUES (
          post_id, cid, 'live_stream', mux_demo, 0, w, h,
          jsonb_build_object(
            'thumbnail_url', thumb,
            'status', CASE WHEN n % 3 = 0 THEN 'live' ELSE 'ended' END,
            'width', w,
            'height', h,
            'aspect_ratio', aspect,
            'dimension_label', dl
          )
        );

      WHEN 10 THEN
        INSERT INTO public.posts (
          id, user_id, content_type, text_content, access_level,
          view_count, like_count, created_at, updated_at, metadata
        ) VALUES (
          post_id, cid, 'text_only',
          format('Text-only #%s — testing feed rhythm without media (%s)', n, dl),
          'public', 90 + n, 3 + (n % 20),
          timezone('utc', now()) - (hours_ago || ' hours')::interval,
          timezone('utc', now()) - (hours_ago || ' hours')::interval,
          jsonb_build_object('seed_pack', pack, 'feed_item_type', 'post', 'type', 'text')
        );

      WHEN 11 THEN
        INSERT INTO public.posts (
          id, user_id, content_type, text_content, access_level,
          created_at, updated_at, metadata
        ) VALUES (
          post_id, cid, 'poll', 'Poll #' || n || ' — pick one',
          'public',
          timezone('utc', now()) - (hours_ago || ' hours')::interval,
          timezone('utc', now()) - (hours_ago || ' hours')::interval,
          jsonb_build_object(
            'seed_pack', pack,
            'type', 'POLL',
            'options', jsonb_build_array(
              jsonb_build_object('id', '1', 'text', 'A', 'order', 0),
              jsonb_build_object('id', '2', 'text', 'B', 'order', 1)
            )
          )
        );

      WHEN 13 THEN
        INSERT INTO public.posts (
          id, user_id, content_type, text_content, access_level,
          created_at, updated_at, metadata
        ) VALUES (
          post_id, cid, 'image',
          'Subscriber drop #' || n,
          'subscribers_only',
          timezone('utc', now()) - (hours_ago || ' hours')::interval,
          timezone('utc', now()) - (hours_ago || ' hours')::interval,
          jsonb_build_object(
            'seed_pack', pack,
            'is_locked', true,
            'dimension_label', dl,
            'preview_thumbnail_url', picsum
          )
        );
        INSERT INTO public.post_media (
          post_id, user_id, media_type, storage_path, blurred_storage_path, order_index, width, height, metadata
        ) VALUES (
          post_id, cid, 'image', picsum, picsum, 0, w, h,
          jsonb_build_object('aspect_ratio', aspect, 'dimension_label', dl)
        );

      WHEN 14 THEN
        INSERT INTO public.posts (
          id, user_id, content_type, text_content, access_level, ppv_price_cents,
          created_at, updated_at, metadata
        ) VALUES (
          post_id, cid, 'video',
          'PPV video #' || n || ' · ' || dl,
          'ppv', 499 + (n % 300),
          timezone('utc', now()) - (hours_ago || ' hours')::interval,
          timezone('utc', now()) - (hours_ago || ' hours')::interval,
          jsonb_build_object('seed_pack', pack, 'ppv_price_credits', ceil((499 + (n % 300))::numeric / 5.0)::int, 'dimension_label', dl)
        );
        INSERT INTO public.post_media (
          post_id, user_id, media_type, mux_playback_id, blurred_storage_path, order_index, width, height, metadata
        ) VALUES (
          post_id, cid, 'video', mux_demo, picsum, 0, w, h,
          jsonb_build_object('thumbnail_url', thumb, 'aspect_ratio', aspect, 'dimension_label', dl)
        );

      WHEN 15 THEN
        INSERT INTO public.posts (
          id, user_id, content_type, text_content, access_level,
          created_at, updated_at, metadata
        ) VALUES (
          post_id, cid, 'image',
          'Teaser #' || n || ' — subscribe for the full set',
          'public',
          timezone('utc', now()) - (hours_ago || ' hours')::interval,
          timezone('utc', now()) - (hours_ago || ' hours')::interval,
          jsonb_build_object(
            'seed_pack', pack,
            'feed_item_type', 'teaser',
            'teaser_for', 'subscription',
            'cta', jsonb_build_object('label', 'Subscribe', 'target_id', cid::text),
            'dimension_label', dl
          )
        );
        INSERT INTO public.post_media (post_id, user_id, media_type, storage_path, order_index, width, height, metadata)
        VALUES (post_id, cid, 'image', picsum, 0, w, h, jsonb_build_object('aspect_ratio', aspect, 'width', w, 'height', h));

      WHEN 16 THEN
        INSERT INTO public.posts (
          id, user_id, content_type, text_content, access_level,
          created_at, updated_at, metadata
        ) VALUES (
          post_id, cid, 'image',
          'Short preview #' || n,
          'public',
          timezone('utc', now()) - ((n % 48) || ' hours')::interval,
          timezone('utc', now()) - ((n % 48) || ' hours')::interval,
          jsonb_build_object(
            'seed_pack', pack,
            'feed_item_type', 'short_preview',
            'short_id', post_id::text,
            'thumbnail_url', thumb,
            'duration_seconds', 15 + (n % 45),
            'dimension_label', dl,
            'width', w,
            'height', h
          )
        );
        INSERT INTO public.post_media (
          post_id, user_id, media_type, mux_playback_id, order_index, width, height, metadata
        ) VALUES (
          post_id, cid, 'short', mux_demo, 0, w, h,
          jsonb_build_object('thumbnail_url', thumb, 'aspect_ratio', aspect, 'dimension_label', dl)
        );

      ELSE
        NULL;
    END CASE;
  END LOOP;

  -- Mux IDs on all volume video/live media
  UPDATE public.post_media pm
  SET mux_playback_id = mux_demo
  FROM public.posts p
  WHERE p.id = pm.post_id
    AND p.metadata->>'seed_pack' = pack
    AND pm.mux_playback_id IS NOT NULL
    AND pm.mux_playback_id <> mux_demo;

  UPDATE public.posts p
  SET metadata = coalesce(p.metadata, '{}'::jsonb) || jsonb_build_object('asset_playback_id', mux_demo)
  WHERE p.metadata->>'seed_pack' = pack
    AND p.content_type = 'live_stream';

  RAISE NOTICE 'feed_scroll_volume: % posts (pack %)', total, pack;
  RAISE NOTICE 'For You feed total (non-short): %',
    (SELECT count(*) FROM public.posts WHERE content_type::text <> 'short');
END;
$vol$;
