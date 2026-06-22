-- =============================================================================
-- Platform bootstrap (idempotent)
-- Consolidates staging fixes: creators Veriff columns, agency grants, image gen,
-- posts/post_media RLS, storage buckets, is_demo.
-- Safe on fresh DB (after 20260514130000) or DB restored from an old backup.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- creators: Veriff + demo flag + AI image gen source path
-- -----------------------------------------------------------------------------
ALTER TABLE public.creators
  ADD COLUMN IF NOT EXISTS veriff_session_id text NULL,
  ADD COLUMN IF NOT EXISTS veriff_verification_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS veriff_estimated_age integer NULL,
  ADD COLUMN IF NOT EXISTS veriff_verification_results jsonb NULL,
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS image_gen_source_path text NULL;

ALTER TABLE public.creators DROP CONSTRAINT IF EXISTS chk_veriff_verification_status;
ALTER TABLE public.creators
  ADD CONSTRAINT chk_veriff_verification_status
  CHECK (veriff_verification_status IN ('not_started', 'in_progress', 'completed', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_creators_veriff_session_id ON public.creators (veriff_session_id);

COMMENT ON COLUMN public.creators.is_demo IS
  'When true, payments/tips/PPV use demo flows without Stripe.';
COMMENT ON COLUMN public.creators.image_gen_source_path IS
  'Storage path for the creator reference image used in AI image generation';

-- Gallery table + RLS created in 20260514130000; ensure PostgREST grants exist
GRANT ALL ON TABLE public.creator_image_gen_gallery TO anon;
GRANT ALL ON TABLE public.creator_image_gen_gallery TO authenticated;
GRANT ALL ON TABLE public.creator_image_gen_gallery TO service_role;

-- -----------------------------------------------------------------------------
-- agencies: PostgREST grants (RLS policies are in 20260428000000)
-- -----------------------------------------------------------------------------
GRANT ALL ON TABLE public.agencies TO anon;
GRANT ALL ON TABLE public.agencies TO authenticated;
GRANT ALL ON TABLE public.agencies TO service_role;

-- -----------------------------------------------------------------------------
-- posts + post_media RLS (repair if RLS enabled without INSERT policies)
-- -----------------------------------------------------------------------------
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS posts_select_authenticated ON public.posts;
CREATE POLICY posts_select_authenticated ON public.posts
  FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS posts_insert_own ON public.posts;
CREATE POLICY posts_insert_own ON public.posts
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS posts_update_own ON public.posts;
CREATE POLICY posts_update_own ON public.posts
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS posts_delete_own ON public.posts;
CREATE POLICY posts_delete_own ON public.posts
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS post_media_select ON public.post_media;
CREATE POLICY post_media_select ON public.post_media
  FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to insert their own post media" ON public.post_media;
DROP POLICY IF EXISTS post_media_insert_own ON public.post_media;
CREATE POLICY post_media_insert_own ON public.post_media
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS post_media_update_own ON public.post_media;
CREATE POLICY post_media_update_own ON public.post_media
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS post_media_delete_own ON public.post_media;
CREATE POLICY post_media_delete_own ON public.post_media
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- storage buckets (often created manually on production)
-- Paths: post-images → public/post_media/{user_id}/… ; avatars → {user_id}/…
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('post-images', 'post-images', true),
  ('creator-content', 'creator-content', true),
  ('avatars', 'avatars', true),
  ('story-media', 'story-media', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS post_images_public_read ON storage.objects;
CREATE POLICY post_images_public_read ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'post-images');

DROP POLICY IF EXISTS post_images_authenticated_insert ON storage.objects;
CREATE POLICY post_images_authenticated_insert ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'post-images'
    AND (storage.foldername(name))[3] = auth.uid()::text
  );

DROP POLICY IF EXISTS post_images_authenticated_update ON storage.objects;
CREATE POLICY post_images_authenticated_update ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'post-images'
    AND (storage.foldername(name))[3] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'post-images'
    AND (storage.foldername(name))[3] = auth.uid()::text
  );

DROP POLICY IF EXISTS post_images_authenticated_delete ON storage.objects;
CREATE POLICY post_images_authenticated_delete ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'post-images'
    AND (storage.foldername(name))[3] = auth.uid()::text
  );

DROP POLICY IF EXISTS creator_content_public_read ON storage.objects;
CREATE POLICY creator_content_public_read ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'creator-content');

DROP POLICY IF EXISTS creator_content_authenticated_insert ON storage.objects;
CREATE POLICY creator_content_authenticated_insert ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'creator-content');

DROP POLICY IF EXISTS creator_content_authenticated_update ON storage.objects;
CREATE POLICY creator_content_authenticated_update ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'creator-content')
  WITH CHECK (bucket_id = 'creator-content');

DROP POLICY IF EXISTS creator_content_authenticated_delete ON storage.objects;
CREATE POLICY creator_content_authenticated_delete ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'creator-content');

DROP POLICY IF EXISTS avatars_public_read ON storage.objects;
CREATE POLICY avatars_public_read ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS avatars_authenticated_insert ON storage.objects;
CREATE POLICY avatars_authenticated_insert ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS avatars_authenticated_update ON storage.objects;
CREATE POLICY avatars_authenticated_update ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS avatars_authenticated_delete ON storage.objects;
CREATE POLICY avatars_authenticated_delete ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS story_media_public_read ON storage.objects;
CREATE POLICY story_media_public_read ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'story-media');

DROP POLICY IF EXISTS story_media_authenticated_insert ON storage.objects;
CREATE POLICY story_media_authenticated_insert ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'story-media');

DROP POLICY IF EXISTS story_media_authenticated_update ON storage.objects;
CREATE POLICY story_media_authenticated_update ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'story-media')
  WITH CHECK (bucket_id = 'story-media');

DROP POLICY IF EXISTS story_media_authenticated_delete ON storage.objects;
CREATE POLICY story_media_authenticated_delete ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'story-media');
