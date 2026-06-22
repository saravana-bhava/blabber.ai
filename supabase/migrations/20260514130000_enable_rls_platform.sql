-- =============================================================================
-- Platform-wide Row Level Security
-- Enables RLS on core tables and adds least-privilege policies for
-- authenticated users. Service role continues to bypass RLS for webhooks/cron.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER so policies can check admin without RLS recursion)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p."isAdmin" = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_conversation_participant(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = p_conversation_id
      AND cp.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_add_conversation_participant(
  p_conversation_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_user_id = auth.uid()
    OR (
      EXISTS (
        SELECT 1
        FROM public.conversations c
        WHERE c.id = p_conversation_id
          AND c.is_group = false
      )
      AND (
        EXISTS (
          SELECT 1
          FROM public.conversation_participants cp
          WHERE cp.conversation_id = p_conversation_id
            AND cp.user_id = auth.uid()
        )
        OR NOT EXISTS (
          SELECT 1
          FROM public.conversation_participants cp
          WHERE cp.conversation_id = p_conversation_id
        )
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.owns_creator_product(p_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.creator_products cp
    WHERE cp.id = p_product_id
      AND cp.creator_profile_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_conversation_participant(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_can_add_conversation_participant(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owns_creator_product(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_add_conversation_participant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_creator_product(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_public ON public.profiles;
CREATE POLICY profiles_select_public ON public.profiles
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- -----------------------------------------------------------------------------
-- creators (agency policies from 20260428000000 apply once RLS is on)
-- -----------------------------------------------------------------------------
ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS creators_select_public ON public.creators;
CREATE POLICY creators_select_public ON public.creators
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS creators_insert_own ON public.creators;
CREATE POLICY creators_insert_own ON public.creators
  FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS creators_update_own ON public.creators;
CREATE POLICY creators_update_own ON public.creators
  FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid() OR public.is_admin())
  WITH CHECK (profile_id = auth.uid() OR public.is_admin());

-- -----------------------------------------------------------------------------
-- posts & media (feed RPCs read posts as invoker; paywall UI needs row visibility)
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
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS posts_delete_own ON public.posts;
CREATE POLICY posts_delete_own ON public.posts
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS post_media_select ON public.post_media;
CREATE POLICY post_media_select ON public.post_media
  FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS post_media_insert_own ON public.post_media;
CREATE POLICY post_media_insert_own ON public.post_media
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS post_media_update_own ON public.post_media;
CREATE POLICY post_media_update_own ON public.post_media
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS post_media_delete_own ON public.post_media;
CREATE POLICY post_media_delete_own ON public.post_media
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- -----------------------------------------------------------------------------
-- comments & engagement
-- -----------------------------------------------------------------------------
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS comments_select ON public.comments;
CREATE POLICY comments_select ON public.comments
  FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS comments_insert_own ON public.comments;
CREATE POLICY comments_insert_own ON public.comments
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS comments_update_own ON public.comments;
CREATE POLICY comments_update_own ON public.comments
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS comments_delete_own ON public.comments;
CREATE POLICY comments_delete_own ON public.comments
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

ALTER TABLE public.user_post_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_post_interactions_select_own ON public.user_post_interactions;
CREATE POLICY user_post_interactions_select_own ON public.user_post_interactions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_post_interactions_insert_own ON public.user_post_interactions;
CREATE POLICY user_post_interactions_insert_own ON public.user_post_interactions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_post_interactions_delete_own ON public.user_post_interactions;
CREATE POLICY user_post_interactions_delete_own ON public.user_post_interactions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

ALTER TABLE public.user_comment_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_comment_interactions_select_own ON public.user_comment_interactions;
CREATE POLICY user_comment_interactions_select_own ON public.user_comment_interactions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_comment_interactions_insert_own ON public.user_comment_interactions;
CREATE POLICY user_comment_interactions_insert_own ON public.user_comment_interactions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_comment_interactions_delete_own ON public.user_comment_interactions;
CREATE POLICY user_comment_interactions_delete_own ON public.user_comment_interactions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS poll_votes_select ON public.poll_votes;
CREATE POLICY poll_votes_select ON public.poll_votes
  FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS poll_votes_insert_own ON public.poll_votes;
CREATE POLICY poll_votes_insert_own ON public.poll_votes
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quiz_attempts_select_own ON public.quiz_attempts;
CREATE POLICY quiz_attempts_select_own ON public.quiz_attempts
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS quiz_attempts_insert_own ON public.quiz_attempts;
CREATE POLICY quiz_attempts_insert_own ON public.quiz_attempts
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- messaging
-- -----------------------------------------------------------------------------
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conversations_select_participant ON public.conversations;
CREATE POLICY conversations_select_participant ON public.conversations
  FOR SELECT
  TO authenticated
  USING (public.is_conversation_participant(id));

DROP POLICY IF EXISTS conversations_insert ON public.conversations;
CREATE POLICY conversations_insert ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS conversations_update_participant ON public.conversations;
CREATE POLICY conversations_update_participant ON public.conversations
  FOR UPDATE
  TO authenticated
  USING (public.is_conversation_participant(id))
  WITH CHECK (public.is_conversation_participant(id));

ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conversation_participants_select ON public.conversation_participants;
CREATE POLICY conversation_participants_select ON public.conversation_participants
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_conversation_participant(conversation_id)
  );

DROP POLICY IF EXISTS conversation_participants_insert ON public.conversation_participants;
CREATE POLICY conversation_participants_insert ON public.conversation_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_can_add_conversation_participant(conversation_id, user_id)
  );

DROP POLICY IF EXISTS conversation_participants_update_own ON public.conversation_participants;
CREATE POLICY conversation_participants_update_own ON public.conversation_participants
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS messages_select_participant ON public.messages;
CREATE POLICY messages_select_participant ON public.messages
  FOR SELECT
  TO authenticated
  USING (public.is_conversation_participant(conversation_id));

DROP POLICY IF EXISTS messages_insert_participant ON public.messages;
CREATE POLICY messages_insert_participant ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_participant(conversation_id)
  );

DROP POLICY IF EXISTS messages_update_sender ON public.messages;
CREATE POLICY messages_update_sender ON public.messages
  FOR UPDATE
  TO authenticated
  USING (
    sender_id = auth.uid()
    AND public.is_conversation_participant(conversation_id)
  )
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_participant(conversation_id)
  );

-- -----------------------------------------------------------------------------
-- subscriptions
-- -----------------------------------------------------------------------------
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscriptions_select_involved ON public.subscriptions;
CREATE POLICY subscriptions_select_involved ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (
    follower_id = auth.uid()
    OR following_id = auth.uid()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS subscriptions_insert_follower ON public.subscriptions;
CREATE POLICY subscriptions_insert_follower ON public.subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (follower_id = auth.uid());

DROP POLICY IF EXISTS subscriptions_update_involved ON public.subscriptions;
CREATE POLICY subscriptions_update_involved ON public.subscriptions
  FOR UPDATE
  TO authenticated
  USING (follower_id = auth.uid() OR following_id = auth.uid() OR public.is_admin())
  WITH CHECK (follower_id = auth.uid() OR following_id = auth.uid() OR public.is_admin());

-- -----------------------------------------------------------------------------
-- financial / transaction tables (read own or creator side; writes via service role)
-- -----------------------------------------------------------------------------
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscription_payments_select ON public.subscription_payments;
CREATE POLICY subscription_payments_select ON public.subscription_payments
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR creator_profile_id = auth.uid()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS subscription_payments_insert_buyer ON public.subscription_payments;
CREATE POLICY subscription_payments_insert_buyer ON public.subscription_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.tip_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tip_transactions_select ON public.tip_transactions;
CREATE POLICY tip_transactions_select ON public.tip_transactions
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR creator_id = auth.uid()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS tip_transactions_insert_buyer ON public.tip_transactions;
CREATE POLICY tip_transactions_insert_buyer ON public.tip_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.ppv_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ppv_transactions_select ON public.ppv_transactions;
CREATE POLICY ppv_transactions_select ON public.ppv_transactions
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = ppv_transactions.post_id
        AND p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = ppv_transactions.message_id
        AND m.sender_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS ppv_transactions_insert_buyer ON public.ppv_transactions;
CREATE POLICY ppv_transactions_insert_buyer ON public.ppv_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.call_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS call_transactions_select ON public.call_transactions;
CREATE POLICY call_transactions_select ON public.call_transactions
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR creator_profile_id = auth.uid()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS call_transactions_insert_fan ON public.call_transactions;
CREATE POLICY call_transactions_insert_fan ON public.call_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND creator_profile_id IS NOT NULL
  );

DROP POLICY IF EXISTS call_transactions_update_fan ON public.call_transactions;
CREATE POLICY call_transactions_update_fan ON public.call_transactions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.call_transcripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS call_transcripts_select ON public.call_transcripts;
CREATE POLICY call_transcripts_select ON public.call_transcripts
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR creator_profile_id = auth.uid()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS call_transcripts_insert_participant ON public.call_transcripts;
CREATE POLICY call_transcripts_insert_participant ON public.call_transcripts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR creator_profile_id = auth.uid()
  );

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS credit_transactions_select_own ON public.credit_transactions;
CREATE POLICY credit_transactions_select_own ON public.credit_transactions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- -----------------------------------------------------------------------------
-- marketplace
-- -----------------------------------------------------------------------------
ALTER TABLE public.creator_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS creator_products_select ON public.creator_products;
CREATE POLICY creator_products_select ON public.creator_products
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true OR creator_profile_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS creator_products_insert_own ON public.creator_products;
CREATE POLICY creator_products_insert_own ON public.creator_products
  FOR INSERT
  TO authenticated
  WITH CHECK (creator_profile_id = auth.uid());

DROP POLICY IF EXISTS creator_products_update_own ON public.creator_products;
CREATE POLICY creator_products_update_own ON public.creator_products
  FOR UPDATE
  TO authenticated
  USING (creator_profile_id = auth.uid() OR public.is_admin())
  WITH CHECK (creator_profile_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS creator_products_delete_own ON public.creator_products;
CREATE POLICY creator_products_delete_own ON public.creator_products
  FOR DELETE
  TO authenticated
  USING (creator_profile_id = auth.uid() OR public.is_admin());

ALTER TABLE public.creator_product_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS creator_product_transactions_select ON public.creator_product_transactions;
CREATE POLICY creator_product_transactions_select ON public.creator_product_transactions
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.creator_products cp
      WHERE cp.id = creator_product_transactions.creator_product_id
        AND cp.creator_profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS creator_product_transactions_insert_buyer ON public.creator_product_transactions;
CREATE POLICY creator_product_transactions_insert_buyer ON public.creator_product_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.creator_product_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS creator_product_orders_select ON public.creator_product_orders;
CREATE POLICY creator_product_orders_select ON public.creator_product_orders
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.owns_creator_product(creator_product_id)
    OR public.is_admin()
  );

DROP POLICY IF EXISTS creator_product_orders_insert_buyer ON public.creator_product_orders;
CREATE POLICY creator_product_orders_insert_buyer ON public.creator_product_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS creator_product_orders_update_creator ON public.creator_product_orders;
CREATE POLICY creator_product_orders_update_creator ON public.creator_product_orders
  FOR UPDATE
  TO authenticated
  USING (public.owns_creator_product(creator_product_id) OR public.is_admin())
  WITH CHECK (public.owns_creator_product(creator_product_id) OR public.is_admin());

-- -----------------------------------------------------------------------------
-- payouts
-- -----------------------------------------------------------------------------
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payouts_select_own ON public.payouts;
CREATE POLICY payouts_select_own ON public.payouts
  FOR SELECT
  TO authenticated
  USING (creator_profile_id = auth.uid() OR public.is_admin());

-- -----------------------------------------------------------------------------
-- platform settings (read for pricing; admin write)
-- -----------------------------------------------------------------------------
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_settings_select ON public.platform_settings;
CREATE POLICY platform_settings_select ON public.platform_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS platform_settings_admin_write ON public.platform_settings;
CREATE POLICY platform_settings_admin_write ON public.platform_settings
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- -----------------------------------------------------------------------------
-- blocked users
-- -----------------------------------------------------------------------------
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS blocked_users_select_own ON public.blocked_users;
CREATE POLICY blocked_users_select_own ON public.blocked_users
  FOR SELECT
  TO authenticated
  USING (blocker_profile_id = auth.uid());

DROP POLICY IF EXISTS blocked_users_insert_own ON public.blocked_users;
CREATE POLICY blocked_users_insert_own ON public.blocked_users
  FOR INSERT
  TO authenticated
  WITH CHECK (blocker_profile_id = auth.uid());

DROP POLICY IF EXISTS blocked_users_delete_own ON public.blocked_users;
CREATE POLICY blocked_users_delete_own ON public.blocked_users
  FOR DELETE
  TO authenticated
  USING (blocker_profile_id = auth.uid());

-- -----------------------------------------------------------------------------
-- creator image gen gallery (if table exists)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.creator_image_gen_gallery (
  id uuid PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  prompt text NULL,
  width integer NULL,
  height integer NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_creator_image_gen_gallery_profile_created
  ON public.creator_image_gen_gallery (profile_id, created_at DESC);

ALTER TABLE public.creator_image_gen_gallery ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS creator_image_gen_gallery_select_own ON public.creator_image_gen_gallery;
CREATE POLICY creator_image_gen_gallery_select_own ON public.creator_image_gen_gallery
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS creator_image_gen_gallery_insert_own ON public.creator_image_gen_gallery;
CREATE POLICY creator_image_gen_gallery_insert_own ON public.creator_image_gen_gallery
  FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS creator_image_gen_gallery_delete_own ON public.creator_image_gen_gallery;
CREATE POLICY creator_image_gen_gallery_delete_own ON public.creator_image_gen_gallery
  FOR DELETE
  TO authenticated
  USING (profile_id = auth.uid());

-- -----------------------------------------------------------------------------
-- notifications: allow delete own (insert via SECURITY DEFINER RPC)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications" ON public.notifications
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- bug reports: fix admin policy to use isAdmin (not username list)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view all bug reports" ON public.bug_reports;
CREATE POLICY "Admins can manage all bug reports" ON public.bug_reports
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- -----------------------------------------------------------------------------
-- pending_onyx_payments: no client insert (API uses service role)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'pending_onyx_payments'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS pending_onyx_payments_insert_own ON public.pending_onyx_payments';
  END IF;
END $$;
-- (intentionally no INSERT policy for authenticated)

-- -----------------------------------------------------------------------------
-- Optional tables (enable only if present; column names match production schema)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'stories'
  ) THEN
    EXECUTE 'ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS stories_select ON public.stories';
    EXECUTE $p$
      CREATE POLICY stories_select ON public.stories
        FOR SELECT TO authenticated, anon USING (true)
    $p$;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'stories' AND column_name = 'profile_id'
    ) THEN
      EXECUTE 'DROP POLICY IF EXISTS stories_insert_own ON public.stories';
      EXECUTE $p$
        CREATE POLICY stories_insert_own ON public.stories
          FOR INSERT TO authenticated WITH CHECK (profile_id = auth.uid())
      $p$;
      EXECUTE 'DROP POLICY IF EXISTS stories_delete_own ON public.stories';
      EXECUTE $p$
        CREATE POLICY stories_delete_own ON public.stories
          FOR DELETE TO authenticated USING (profile_id = auth.uid())
      $p$;
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'stories' AND column_name = 'user_id'
    ) THEN
      EXECUTE 'DROP POLICY IF EXISTS stories_insert_own ON public.stories';
      EXECUTE $p$
        CREATE POLICY stories_insert_own ON public.stories
          FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())
      $p$;
      EXECUTE 'DROP POLICY IF EXISTS stories_delete_own ON public.stories';
      EXECUTE $p$
        CREATE POLICY stories_delete_own ON public.stories
          FOR DELETE TO authenticated USING (user_id = auth.uid())
      $p$;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'live_stories'
  ) THEN
    EXECUTE 'ALTER TABLE public.live_stories ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS live_stories_select ON public.live_stories';
    EXECUTE $p$
      CREATE POLICY live_stories_select ON public.live_stories
        FOR SELECT TO authenticated, anon USING (true)
    $p$;
    EXECUTE 'DROP POLICY IF EXISTS live_stories_insert_own ON public.live_stories';
    EXECUTE $p$
      CREATE POLICY live_stories_insert_own ON public.live_stories
        FOR INSERT TO authenticated WITH CHECK (profile_id = auth.uid())
    $p$;
    EXECUTE 'DROP POLICY IF EXISTS live_stories_update_own ON public.live_stories';
    EXECUTE $p$
      CREATE POLICY live_stories_update_own ON public.live_stories
        FOR UPDATE TO authenticated
        USING (profile_id = auth.uid())
        WITH CHECK (profile_id = auth.uid())
    $p$;
    EXECUTE 'DROP POLICY IF EXISTS live_stories_delete_own ON public.live_stories';
    EXECUTE $p$
      CREATE POLICY live_stories_delete_own ON public.live_stories
        FOR DELETE TO authenticated USING (profile_id = auth.uid())
    $p$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'user_story_views'
  ) THEN
    EXECUTE 'ALTER TABLE public.user_story_views ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS user_story_views_own ON public.user_story_views';
    EXECUTE $p$
      CREATE POLICY user_story_views_own ON public.user_story_views
        FOR ALL TO authenticated
        USING (viewer_profile_id = auth.uid())
        WITH CHECK (viewer_profile_id = auth.uid())
    $p$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'likes'
  ) THEN
    EXECUTE 'ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS likes_select ON public.likes';
    EXECUTE $p$
      CREATE POLICY likes_select ON public.likes
        FOR SELECT TO authenticated, anon USING (true)
    $p$;
    EXECUTE 'DROP POLICY IF EXISTS likes_insert_own ON public.likes';
    EXECUTE $p$
      CREATE POLICY likes_insert_own ON public.likes
        FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())
    $p$;
    EXECUTE 'DROP POLICY IF EXISTS likes_delete_own ON public.likes';
    EXECUTE $p$
      CREATE POLICY likes_delete_own ON public.likes
        FOR DELETE TO authenticated USING (user_id = auth.uid())
    $p$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'post_likes'
  ) THEN
    EXECUTE 'ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS post_likes_select ON public.post_likes';
    EXECUTE $p$
      CREATE POLICY post_likes_select ON public.post_likes
        FOR SELECT TO authenticated, anon USING (true)
    $p$;
    EXECUTE 'DROP POLICY IF EXISTS post_likes_insert_own ON public.post_likes';
    EXECUTE $p$
      CREATE POLICY post_likes_insert_own ON public.post_likes
        FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())
    $p$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'post_bookmarks'
  ) THEN
    EXECUTE 'ALTER TABLE public.post_bookmarks ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS post_bookmarks_select_own ON public.post_bookmarks';
    EXECUTE $p$
      CREATE POLICY post_bookmarks_select_own ON public.post_bookmarks
        FOR SELECT TO authenticated USING (user_id = auth.uid())
    $p$;
    EXECUTE 'DROP POLICY IF EXISTS post_bookmarks_insert_own ON public.post_bookmarks';
    EXECUTE $p$
      CREATE POLICY post_bookmarks_insert_own ON public.post_bookmarks
        FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())
    $p$;
    EXECUTE 'DROP POLICY IF EXISTS post_bookmarks_delete_own ON public.post_bookmarks';
    EXECUTE $p$
      CREATE POLICY post_bookmarks_delete_own ON public.post_bookmarks
        FOR DELETE TO authenticated USING (user_id = auth.uid())
    $p$;
  END IF;
END;
$$;
