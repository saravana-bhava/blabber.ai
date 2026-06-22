-- =============================================================================
-- Fix: set search_path = '' on all public functions
-- Resolves Supabase security lint 0011 (function_search_path_mutable).
-- All table/type/function references are fully schema-qualified (public.*) so
-- each function is immune to search-path injection by unprivileged users.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Timestamp trigger helpers (no table access)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_bug_reports_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_agencies_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- Pure computation (no table access)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.generate_random_username(length integer DEFAULT 16)
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    chars  text    := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    result text    := '';
    i      integer := 0;
BEGIN
    FOR i IN 1..length LOOP
        result := result || substr(chars, floor(random() * length(chars))::integer + 1, 1);
    END LOOP;
    RETURN result;
END;
$$;

-- -----------------------------------------------------------------------------
-- Post counter functions
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.decrement_bookmark_count(p_post_id uuid)
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    new_bookmark_count INTEGER;
BEGIN
    UPDATE public.posts
    SET bookmark_count = GREATEST(0, bookmark_count - 1)
    WHERE id = p_post_id
    RETURNING bookmark_count INTO new_bookmark_count;
    RETURN new_bookmark_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_bookmark_count(p_post_id uuid)
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    new_bookmark_count INTEGER;
BEGIN
    UPDATE public.posts
    SET bookmark_count = bookmark_count + 1
    WHERE id = p_post_id
    RETURNING bookmark_count INTO new_bookmark_count;
    RETURN new_bookmark_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_like_count(p_post_id uuid)
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    new_like_count INTEGER;
BEGIN
    UPDATE public.posts
    SET like_count = GREATEST(0, like_count - 1)
    WHERE id = p_post_id
    RETURNING like_count INTO new_like_count;
    RETURN new_like_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_like_count(p_post_id uuid)
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    new_like_count INTEGER;
BEGIN
    UPDATE public.posts
    SET like_count = like_count + 1
    WHERE id = p_post_id
    RETURNING like_count INTO new_like_count;
    RETURN new_like_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_comment_count(p_post_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    new_count INTEGER;
BEGIN
    UPDATE public.posts
    SET comment_count = comment_count + 1
    WHERE id = p_post_id
    RETURNING comment_count INTO new_count;
    RETURN COALESCE(new_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_comment_count(p_post_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    new_count INTEGER;
BEGIN
    UPDATE public.posts
    SET comment_count = GREATEST(comment_count - 1, 0)
    WHERE id = p_post_id
    RETURNING comment_count INTO new_count;
    RETURN COALESCE(new_count, 0);
END;
$$;

-- Comment counter functions

CREATE OR REPLACE FUNCTION public.decrement_comment_like_count(p_comment_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    new_count INTEGER;
BEGIN
    UPDATE public.comments
    SET like_count = GREATEST(like_count - 1, 0)
    WHERE id = p_comment_id
    RETURNING like_count INTO new_count;
    RETURN COALESCE(new_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_comment_like_count(p_comment_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    new_count INTEGER;
BEGIN
    UPDATE public.comments
    SET like_count = like_count + 1
    WHERE id = p_comment_id
    RETURNING like_count INTO new_count;
    RETURN COALESCE(new_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_reply_count(p_parent_comment_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    new_count INTEGER;
BEGIN
    UPDATE public.comments
    SET reply_count = GREATEST(reply_count - 1, 0)
    WHERE id = p_parent_comment_id
    RETURNING reply_count INTO new_count;
    RETURN COALESCE(new_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_reply_count(p_parent_comment_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    new_count INTEGER;
BEGIN
    UPDATE public.comments
    SET reply_count = reply_count + 1
    WHERE id = p_parent_comment_id
    RETURNING reply_count INTO new_count;
    RETURN COALESCE(new_count, 0);
END;
$$;

-- -----------------------------------------------------------------------------
-- Notification functions (SECURITY DEFINER — service-role-like writes)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_notification(
    p_user_id         uuid,
    p_actor_id        uuid,
    p_notification_type text,
    p_title           text,
    p_body            text,
    p_data            jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    notification_id UUID;
BEGIN
    INSERT INTO public.notifications (
        user_id,
        actor_id,
        notification_type,
        title,
        body,
        data
    ) VALUES (
        p_user_id,
        p_actor_id,
        p_notification_type,
        p_title,
        p_body,
        p_data
    ) RETURNING id INTO notification_id;
    RETURN notification_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_notifications_read(
    p_user_id         uuid,
    p_notification_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    IF p_notification_ids IS NULL THEN
        UPDATE public.notifications
        SET is_read = true
        WHERE user_id = p_user_id AND is_read = false;
        GET DIAGNOSTICS updated_count = ROW_COUNT;
    ELSE
        UPDATE public.notifications
        SET is_read = true
        WHERE user_id = p_user_id
          AND id = ANY(p_notification_ids)
          AND is_read = false;
        GET DIAGNOSTICS updated_count = ROW_COUNT;
    END IF;
    RETURN updated_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_unread_notification_count(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    count INTEGER;
BEGIN
    SELECT COUNT(*) INTO count
    FROM public.notifications
    WHERE user_id = p_user_id AND is_read = false;
    RETURN count;
END;
$$;

-- -----------------------------------------------------------------------------
-- Profile management triggers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    new_username   text;
    username_exists boolean;
    attempts       integer := 0;
    max_attempts   integer := 10;
BEGIN
    IF NEW.username IS NULL THEN
        LOOP
            new_username := public.generate_random_username(16);
            SELECT EXISTS(
                SELECT 1 FROM public.profiles WHERE username = new_username
            ) INTO username_exists;
            IF NOT username_exists THEN
                NEW.username := new_username;
                EXIT;
            END IF;
            attempts := attempts + 1;
            IF attempts >= max_attempts THEN
                RAISE EXCEPTION 'Could not generate unique username after % attempts', max_attempts;
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, username)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data ->> 'full_name',
        NEW.raw_user_meta_data ->> 'username'
    );
    RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- Content enforcement trigger
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_post_monetization_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    creator_can_monetize boolean;
BEGIN
    IF (NEW.access_level = 'subscribers_only' OR NEW.access_level = 'ppv') THEN
        SELECT c.can_monetize INTO creator_can_monetize
        FROM public.creators c
        WHERE c.profile_id = NEW.user_id;
        IF NOT FOUND OR creator_can_monetize IS NOT TRUE THEN
            RAISE EXCEPTION 'User (profile_id: %) is not authorized to create monetized posts (subscribers_only or ppv), or has not completed creator onboarding.', NEW.user_id;
        END IF;
    END IF;
    IF NEW.access_level = 'ppv' THEN
        IF (NEW.ppv_price_cents IS NULL OR NEW.ppv_price_cents <= 0) THEN
            RAISE EXCEPTION 'PPV posts must have a valid price (ppv_price_cents > 0).';
        END IF;
    ELSE
        IF NEW.ppv_price_cents IS NOT NULL THEN
            RAISE EXCEPTION 'Only PPV posts can have a price. For % posts, ppv_price_cents must be NULL.', NEW.access_level;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- Engagement count triggers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_comment_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
        IF NEW.parent_comment_id IS NOT NULL THEN
            UPDATE public.comments SET reply_count = reply_count + 1 WHERE id = NEW.parent_comment_id;
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.posts SET comment_count = comment_count - 1 WHERE id = OLD.post_id;
        IF OLD.parent_comment_id IS NOT NULL THEN
            UPDATE public.comments SET reply_count = reply_count - 1 WHERE id = OLD.parent_comment_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_like_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF NEW.post_id IS NOT NULL THEN
            UPDATE public.posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
        ELSIF NEW.comment_id IS NOT NULL THEN
            UPDATE public.comments SET like_count = like_count + 1 WHERE id = NEW.comment_id;
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        IF OLD.post_id IS NOT NULL THEN
            UPDATE public.posts SET like_count = like_count - 1 WHERE id = OLD.post_id;
        ELSIF OLD.comment_id IS NOT NULL THEN
            UPDATE public.comments SET like_count = like_count - 1 WHERE id = OLD.comment_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$;

-- -----------------------------------------------------------------------------
-- Messaging helpers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_has_unread_msg_for_conversation(conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    participant  RECORD;
    unread_count INTEGER;
BEGIN
    FOR participant IN
        SELECT user_id
        FROM public.conversation_participants
        WHERE public.conversation_participants.conversation_id =
              update_has_unread_msg_for_conversation.conversation_id
    LOOP
        SELECT COUNT(*)
        INTO unread_count
        FROM public.conversation_participants cp
        JOIN public.conversations c ON cp.conversation_id = c.id
        WHERE cp.user_id = participant.user_id
          AND c.last_message_id IS NOT NULL
          AND cp.last_read_message_id IS DISTINCT FROM c.last_message_id
          AND (
            SELECT sender_id FROM public.messages WHERE id = c.last_message_id
          ) IS DISTINCT FROM participant.user_id;

        UPDATE public.profiles
        SET "hasUnreadMsg" = (unread_count > 0)
        WHERE id = participant.user_id;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.after_conversation_last_message_update_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    RAISE WARNING 'after_conversation_last_message_update_trigger fired for conversation_id: %', NEW.id;
    PERFORM public.update_has_unread_msg_for_conversation(NEW.id);
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.after_last_read_update_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    PERFORM public.update_has_unread_msg_for_conversation(NEW.conversation_id);
    RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- Financial reporting
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_monthly_financials(p_month integer, p_year integer)
RETURNS TABLE(
    gross_revenue      numeric,
    net_revenue        numeric,
    creator_payouts    numeric,
    platform_fees      numeric,
    total_transactions bigint
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    start_date TIMESTAMPTZ;
    end_date   TIMESTAMPTZ;
BEGIN
    start_date := make_timestamptz(p_year, p_month, 1, 0, 0, 0);
    end_date   := start_date + interval '1 month';

    RETURN QUERY
    WITH all_transactions AS (
        SELECT amount_cents, platform_share_cents, creator_share_cents
        FROM public.tip_transactions
        WHERE created_at >= start_date AND created_at < end_date AND status != 'pending'
        UNION ALL
        SELECT amount_cents, platform_share_cents, creator_share_cents
        FROM public.ppv_transactions
        WHERE created_at >= start_date AND created_at < end_date AND status != 'pending'
        UNION ALL
        SELECT amount_cents, platform_share_cents, creator_share_cents
        FROM public.subscription_payments
        WHERE created_at >= start_date AND created_at < end_date AND status != 'pending'
        UNION ALL
        SELECT amount_cents, platform_share_cents, creator_share_cents
        FROM public.creator_product_transactions
        WHERE created_at >= start_date AND created_at < end_date AND status != 'pending'
        UNION ALL
        SELECT amount_cents, amount_cents AS platform_share_cents, 0 AS creator_share_cents
        FROM public.credit_transactions
        WHERE created_at >= start_date AND created_at < end_date AND status != 'pending'
    )
    SELECT
        COALESCE(SUM(t.amount_cents),          0)::NUMERIC AS gross_revenue,
        COALESCE(SUM(t.platform_share_cents),  0)::NUMERIC AS net_revenue,
        COALESCE(SUM(t.creator_share_cents),   0)::NUMERIC AS creator_payouts,
        COALESCE(SUM(t.amount_cents * 0.029 + 30), 0)::NUMERIC AS platform_fees,
        COUNT(t.*)::BIGINT AS total_transactions
    FROM all_transactions t;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_monthly_transactions(p_month integer, p_year integer)
RETURNS TABLE(
    transaction_id      uuid,
    transaction_type    text,
    user_name           text,
    creator_name        text,
    amount_cents        integer,
    platform_share_cents integer,
    creator_share_cents integer,
    created_at          timestamp with time zone
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    start_date TIMESTAMPTZ;
    end_date   TIMESTAMPTZ;
BEGIN
    start_date := make_timestamptz(p_year, p_month, 1, 0, 0, 0);
    end_date   := start_date + interval '1 month';

    RETURN QUERY
    SELECT t.id,        'Tip'::text,          u.username, c.username,
           t.amount_cents, t.platform_share_cents, t.creator_share_cents, t.created_at
    FROM public.tip_transactions t
    JOIN  public.profiles u ON t.user_id   = u.id
    LEFT JOIN public.profiles c ON t.creator_id = c.id
    WHERE t.created_at >= start_date AND t.created_at < end_date

    UNION ALL

    SELECT ppv.id,      'PPV'::text,          u.username, c.username,
           ppv.amount_cents, ppv.platform_share_cents, ppv.creator_share_cents, ppv.created_at
    FROM public.ppv_transactions ppv
    JOIN  public.profiles u ON ppv.user_id = u.id
    LEFT JOIN public.posts    po ON ppv.post_id = po.id
    LEFT JOIN public.profiles  c ON po.user_id  = c.id
    WHERE ppv.created_at >= start_date AND ppv.created_at < end_date

    UNION ALL

    SELECT sp.id,       'Subscription'::text, u.username, c.username,
           sp.amount_cents, sp.platform_share_cents, sp.creator_share_cents, sp.created_at
    FROM public.subscription_payments sp
    JOIN  public.profiles u ON sp.user_id          = u.id
    LEFT JOIN public.profiles c ON sp.creator_profile_id = c.id
    WHERE sp.created_at >= start_date AND sp.created_at < end_date

    UNION ALL

    SELECT cpt.id,      'Product'::text,      u.username, cr.username,
           cpt.amount_cents, cpt.platform_share_cents, cpt.creator_share_cents, cpt.created_at
    FROM public.creator_product_transactions cpt
    JOIN  public.profiles         u  ON cpt.user_id             = u.id
    LEFT JOIN public.creator_products cp ON cpt.creator_product_id = cp.id
    LEFT JOIN public.profiles        cr ON cp.creator_profile_id   = cr.id
    WHERE cpt.created_at >= start_date AND cpt.created_at < end_date

    UNION ALL

    SELECT ct.id,       'Credit Purchase'::text, u.username, 'N/A'::text,
           ct.amount_cents, ct.amount_cents AS platform_share_cents, 0, ct.created_at
    FROM public.credit_transactions ct
    JOIN  public.profiles u ON ct.user_id = u.id
    WHERE ct.created_at >= start_date AND ct.created_at < end_date;
END;
$$;

-- -----------------------------------------------------------------------------
-- Feed / explore / shorts query functions
-- All three get_feed_posts_with_interactions overloads are preserved.
-- -----------------------------------------------------------------------------

-- Overload 1: single-user feed (uuid signature, returns typed enums)
CREATE OR REPLACE FUNCTION public.get_feed_posts_with_interactions(
    p_user_id uuid,
    p_limit   integer,
    p_offset  integer
)
RETURNS TABLE(
    id           uuid,
    user_id      uuid,
    created_at   timestamp with time zone,
    updated_at   timestamp with time zone,
    content_type public.post_content_type,
    text_content text,
    tags         text[],
    category     text,
    view_count   integer,
    like_count   integer,
    comment_count integer,
    share_count  integer,
    bookmark_count integer,
    access_level public.post_access_level,
    ppv_price_cents integer,
    metadata     jsonb,
    profiles     jsonb,
    post_media   jsonb,
    poll_results jsonb,
    user_poll_vote text,
    user_quiz_attempt jsonb,
    user_has_liked    boolean,
    user_has_bookmarked boolean
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id, p.user_id, p.created_at, p.updated_at,
        p.content_type, p.text_content, p.tags, p.category,
        p.view_count, p.like_count, p.comment_count, p.share_count, p.bookmark_count,
        p.access_level, p.ppv_price_cents, p.metadata,
        to_jsonb(prof) AS profiles,
        (SELECT COALESCE(jsonb_agg(pm.* ORDER BY pm.order_index ASC), '[]'::jsonb)
         FROM public.post_media pm WHERE pm.post_id = p.id) AS post_media,
        (SELECT COALESCE(jsonb_agg(pr.*), '[]'::jsonb)
         FROM (SELECT pv.selected_option_id AS option_id, COUNT(pv.id)::INTEGER AS vote_count
               FROM public.poll_votes pv WHERE pv.post_id = p.id
               GROUP BY pv.selected_option_id) pr) AS poll_results,
        (SELECT pv.selected_option_id FROM public.poll_votes pv
         WHERE pv.post_id = p.id AND pv.user_id = p_user_id LIMIT 1) AS user_poll_vote,
        (SELECT to_jsonb(qa.*) FROM public.quiz_attempts qa
         WHERE qa.post_id = p.id AND qa.user_id = p_user_id
         ORDER BY qa.attempted_at DESC LIMIT 1) AS user_quiz_attempt,
        EXISTS(SELECT 1 FROM public.user_post_interactions upi
               WHERE upi.post_id = p.id AND upi.user_id = p_user_id
                 AND upi.interaction_type = 'post_like') AS user_has_liked,
        EXISTS(SELECT 1 FROM public.user_post_interactions upi
               WHERE upi.post_id = p.id AND upi.user_id = p_user_id
                 AND upi.interaction_type = 'post_save') AS user_has_bookmarked
    FROM public.posts p
    JOIN public.profiles prof ON p.user_id = prof.id
    ORDER BY p.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Overload 2: text user_id, optional user/bookmark filters (5-param)
CREATE OR REPLACE FUNCTION public.get_feed_posts_with_interactions(
    p_current_user_id          text,
    p_limit                    integer,
    p_offset                   integer,
    p_filter_by_user_id        text DEFAULT NULL::text,
    p_filter_bookmarked_by_user_id text DEFAULT NULL::text
)
RETURNS TABLE(
    id           uuid,
    user_id      uuid,
    created_at   timestamp with time zone,
    updated_at   timestamp with time zone,
    content_type text,
    text_content text,
    tags         text[],
    category     text,
    view_count   integer,
    like_count   integer,
    comment_count integer,
    share_count  integer,
    bookmark_count integer,
    access_level text,
    ppv_price_cents integer,
    metadata     jsonb,
    profiles     jsonb,
    post_media   jsonb,
    poll_results jsonb,
    user_poll_vote text,
    user_quiz_attempt jsonb,
    user_has_liked    boolean,
    user_has_bookmarked boolean
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_current_user_uuid           UUID;
    v_filter_by_user_uuid         UUID;
    v_filter_bookmarked_by_user_uuid UUID;
BEGIN
    BEGIN v_current_user_uuid := p_current_user_id::UUID;
    EXCEPTION WHEN invalid_text_representation THEN v_current_user_uuid := NULL; END;

    BEGIN v_filter_by_user_uuid := p_filter_by_user_id::UUID;
    EXCEPTION WHEN invalid_text_representation THEN v_filter_by_user_uuid := NULL; END;

    BEGIN v_filter_bookmarked_by_user_uuid := p_filter_bookmarked_by_user_id::UUID;
    EXCEPTION WHEN invalid_text_representation THEN v_filter_bookmarked_by_user_uuid := NULL; END;

    RETURN QUERY
    SELECT
        p.id, p.user_id, p.created_at, p.updated_at,
        p.content_type::TEXT, p.text_content, p.tags, p.category,
        p.view_count, p.like_count, p.comment_count, p.share_count, p.bookmark_count,
        p.access_level::TEXT, p.ppv_price_cents, p.metadata,
        to_jsonb(prof) AS profiles,
        (SELECT COALESCE(jsonb_agg(pm_s.* ORDER BY pm_s.order_index ASC), '[]'::jsonb)
         FROM public.post_media pm_s WHERE pm_s.post_id = p.id) AS post_media,
        (SELECT COALESCE(jsonb_agg(pr_s.*), '[]'::jsonb)
         FROM (SELECT pv_s.selected_option_id AS option_id, COUNT(pv_s.id)::INTEGER AS vote_count
               FROM public.poll_votes pv_s WHERE pv_s.post_id = p.id
               GROUP BY pv_s.selected_option_id) pr_s) AS poll_results,
        (SELECT pv_u.selected_option_id FROM public.poll_votes pv_u
         WHERE pv_u.post_id = p.id AND pv_u.user_id = v_current_user_uuid LIMIT 1) AS user_poll_vote,
        (SELECT to_jsonb(qa_s.*) FROM public.quiz_attempts qa_s
         WHERE qa_s.post_id = p.id AND qa_s.user_id = v_current_user_uuid
         ORDER BY qa_s.attempted_at DESC LIMIT 1) AS user_quiz_attempt,
        EXISTS(SELECT 1 FROM public.user_post_interactions upi_l
               WHERE upi_l.post_id = p.id AND upi_l.user_id = v_current_user_uuid
                 AND upi_l.interaction_type = 'post_like') AS user_has_liked,
        EXISTS(SELECT 1 FROM public.user_post_interactions upi_b
               WHERE upi_b.post_id = p.id AND upi_b.user_id = v_current_user_uuid
                 AND upi_b.interaction_type = 'post_save') AS user_has_bookmarked
    FROM public.posts p
    JOIN public.profiles prof ON p.user_id = prof.id
    LEFT JOIN public.user_post_interactions upi_bm_f
        ON v_filter_bookmarked_by_user_uuid IS NOT NULL
       AND p.id = upi_bm_f.post_id
       AND upi_bm_f.user_id = v_filter_bookmarked_by_user_uuid
       AND upi_bm_f.interaction_type = 'post_save'
    WHERE (v_filter_by_user_uuid IS NULL OR p.user_id = v_filter_by_user_uuid)
      AND (v_filter_bookmarked_by_user_uuid IS NULL OR upi_bm_f.id IS NOT NULL)
    ORDER BY p.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Overload 3: text user_id + content_type + search_query filters (7-param, latest)
CREATE OR REPLACE FUNCTION public.get_feed_posts_with_interactions(
    p_current_user_id          text,
    p_limit                    integer,
    p_offset                   integer,
    p_filter_by_user_id        text DEFAULT NULL::text,
    p_filter_bookmarked_by_user_id text DEFAULT NULL::text,
    p_content_type             text DEFAULT NULL::text,
    p_search_query             text DEFAULT NULL::text
)
RETURNS TABLE(
    id           uuid,
    user_id      uuid,
    created_at   timestamp with time zone,
    updated_at   timestamp with time zone,
    content_type text,
    text_content text,
    tags         text[],
    category     character varying,
    view_count   integer,
    like_count   integer,
    comment_count integer,
    share_count  integer,
    bookmark_count integer,
    access_level text,
    ppv_price_cents integer,
    metadata     jsonb,
    profiles     jsonb,
    post_media   jsonb,
    poll_results jsonb,
    user_poll_vote uuid,
    user_quiz_attempt jsonb,
    user_has_liked    boolean,
    user_has_bookmarked boolean
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_current_user_uuid           UUID;
    v_filter_by_user_uuid         UUID;
    v_filter_bookmarked_by_user_uuid UUID;
BEGIN
    BEGIN v_current_user_uuid := p_current_user_id::UUID;
    EXCEPTION WHEN invalid_text_representation THEN v_current_user_uuid := NULL; END;

    BEGIN v_filter_by_user_uuid := p_filter_by_user_id::UUID;
    EXCEPTION WHEN invalid_text_representation THEN v_filter_by_user_uuid := NULL; END;

    BEGIN v_filter_bookmarked_by_user_uuid := p_filter_bookmarked_by_user_id::UUID;
    EXCEPTION WHEN invalid_text_representation THEN v_filter_bookmarked_by_user_uuid := NULL; END;

    RETURN QUERY
    SELECT
        p.id, p.user_id, p.created_at, p.updated_at,
        p.content_type::TEXT, p.text_content, p.tags, p.category::VARCHAR(255),
        p.view_count, p.like_count, p.comment_count, p.share_count, p.bookmark_count,
        p.access_level::TEXT, p.ppv_price_cents, p.metadata,
        to_jsonb(prof) AS profiles,
        (SELECT COALESCE(jsonb_agg(pm_s.* ORDER BY pm_s.order_index ASC), '[]'::jsonb)
         FROM public.post_media pm_s WHERE pm_s.post_id = p.id) AS post_media,
        (SELECT COALESCE(jsonb_agg(json_build_object('option_id', T.selected_option_id, 'vote_count', T.vote_count)), '[]'::jsonb)
         FROM (SELECT pv_t.selected_option_id, COUNT(pv_t.id)::INTEGER AS vote_count
               FROM public.poll_votes pv_t WHERE pv_t.post_id = p.id
               GROUP BY pv_t.selected_option_id) AS T) AS poll_results,
        (SELECT pv_u.selected_option_id::UUID FROM public.poll_votes pv_u
         WHERE pv_u.post_id = p.id AND pv_u.user_id = v_current_user_uuid LIMIT 1) AS user_poll_vote,
        (SELECT to_jsonb(qa_s.*) FROM public.quiz_attempts qa_s
         WHERE qa_s.post_id = p.id AND qa_s.user_id = v_current_user_uuid
         ORDER BY qa_s.attempted_at DESC LIMIT 1) AS user_quiz_attempt,
        EXISTS(SELECT 1 FROM public.user_post_interactions upi_l
               WHERE upi_l.post_id = p.id AND upi_l.user_id = v_current_user_uuid
                 AND upi_l.interaction_type = 'post_like') AS user_has_liked,
        EXISTS(SELECT 1 FROM public.user_post_interactions upi_b
               WHERE upi_b.post_id = p.id AND upi_b.user_id = v_current_user_uuid
                 AND upi_b.interaction_type = 'post_save') AS user_has_bookmarked
    FROM public.posts p
    JOIN public.profiles prof ON p.user_id = prof.id
    LEFT JOIN public.user_post_interactions upi_bm_f
        ON v_filter_bookmarked_by_user_uuid IS NOT NULL
       AND p.id = upi_bm_f.post_id
       AND upi_bm_f.user_id = v_filter_bookmarked_by_user_uuid
       AND upi_bm_f.interaction_type = 'post_save'
    WHERE (v_filter_by_user_uuid IS NULL OR p.user_id = v_filter_by_user_uuid)
      AND (v_filter_bookmarked_by_user_uuid IS NULL OR upi_bm_f.id IS NOT NULL)
      AND (CASE
               WHEN p_content_type IS NOT NULL THEN p.content_type::TEXT = p_content_type
               ELSE p.content_type::TEXT <> 'short'
           END)
      AND (p_search_query IS NULL OR p.text_content ILIKE '%' || p_search_query || '%')
    ORDER BY p.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- get_explore_posts_with_interactions (latest from 20240422000000)
CREATE OR REPLACE FUNCTION public.get_explore_posts_with_interactions(
    p_current_user_id          text,
    p_limit                    integer,
    p_offset                   integer,
    p_filter_by_user_id        text DEFAULT NULL::text,
    p_filter_bookmarked_by_user_id text DEFAULT NULL::text,
    p_search_query             text DEFAULT NULL::text
)
RETURNS TABLE(
    id           uuid,
    user_id      uuid,
    created_at   timestamp with time zone,
    updated_at   timestamp with time zone,
    content_type text,
    text_content text,
    tags         text[],
    category     character varying,
    view_count   integer,
    like_count   integer,
    comment_count integer,
    share_count  integer,
    bookmark_count integer,
    access_level text,
    ppv_price_cents integer,
    metadata     jsonb,
    profiles     jsonb,
    post_media   jsonb,
    poll_results jsonb,
    user_poll_vote uuid,
    user_quiz_attempt jsonb,
    user_has_liked    boolean,
    user_has_bookmarked boolean
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_current_user_uuid           UUID;
    v_filter_by_user_uuid         UUID;
    v_filter_bookmarked_by_user_uuid UUID;
BEGIN
    BEGIN v_current_user_uuid := p_current_user_id::UUID;
    EXCEPTION WHEN invalid_text_representation THEN v_current_user_uuid := NULL; END;

    BEGIN v_filter_by_user_uuid := p_filter_by_user_id::UUID;
    EXCEPTION WHEN invalid_text_representation THEN v_filter_by_user_uuid := NULL; END;

    BEGIN v_filter_bookmarked_by_user_uuid := p_filter_bookmarked_by_user_id::UUID;
    EXCEPTION WHEN invalid_text_representation THEN v_filter_bookmarked_by_user_uuid := NULL; END;

    RETURN QUERY
    SELECT
        p.id, p.user_id, p.created_at, p.updated_at,
        p.content_type::TEXT, p.text_content, p.tags, p.category::VARCHAR(255),
        p.view_count, p.like_count, p.comment_count, p.share_count, p.bookmark_count,
        p.access_level::TEXT, p.ppv_price_cents, p.metadata,
        to_jsonb(prof) AS profiles,
        (SELECT COALESCE(jsonb_agg(pm_s.* ORDER BY pm_s.order_index ASC), '[]'::jsonb)
         FROM public.post_media pm_s WHERE pm_s.post_id = p.id) AS post_media,
        (SELECT COALESCE(jsonb_agg(json_build_object('option_id', T.selected_option_id, 'vote_count', T.vote_count)), '[]'::jsonb)
         FROM (SELECT pv_t.selected_option_id, COUNT(pv_t.id)::INTEGER AS vote_count
               FROM public.poll_votes pv_t WHERE pv_t.post_id = p.id
               GROUP BY pv_t.selected_option_id) AS T) AS poll_results,
        (SELECT pv_u.selected_option_id::UUID FROM public.poll_votes pv_u
         WHERE pv_u.post_id = p.id AND pv_u.user_id = v_current_user_uuid LIMIT 1) AS user_poll_vote,
        (SELECT to_jsonb(qa_s.*) FROM public.quiz_attempts qa_s
         WHERE qa_s.post_id = p.id AND qa_s.user_id = v_current_user_uuid
         ORDER BY qa_s.attempted_at DESC LIMIT 1) AS user_quiz_attempt,
        EXISTS(SELECT 1 FROM public.user_post_interactions upi_l
               WHERE upi_l.post_id = p.id AND upi_l.user_id = v_current_user_uuid
                 AND upi_l.interaction_type = 'post_like') AS user_has_liked,
        EXISTS(SELECT 1 FROM public.user_post_interactions upi_b
               WHERE upi_b.post_id = p.id AND upi_b.user_id = v_current_user_uuid
                 AND upi_b.interaction_type = 'post_save') AS user_has_bookmarked
    FROM public.posts p
    JOIN public.profiles prof ON p.user_id = prof.id
    LEFT JOIN public.user_post_interactions upi_bm_f
        ON v_filter_bookmarked_by_user_uuid IS NOT NULL
       AND p.id = upi_bm_f.post_id
       AND upi_bm_f.user_id = v_filter_bookmarked_by_user_uuid
       AND upi_bm_f.interaction_type = 'post_save'
    WHERE (v_filter_by_user_uuid IS NULL OR p.user_id = v_filter_by_user_uuid)
      AND (v_filter_bookmarked_by_user_uuid IS NULL OR upi_bm_f.id IS NOT NULL)
      AND (
            p.content_type::TEXT IN ('image', 'video', 'carousel')
            OR EXISTS (
                SELECT 1 FROM public.post_media pm
                WHERE pm.post_id = p.id AND pm.media_type = 'short'
            )
          )
      AND (
            p_search_query IS NULL
            OR p.text_content ILIKE '%' || p_search_query || '%'
            OR prof.username  ILIKE '%' || p_search_query || '%'
            OR prof.full_name ILIKE '%' || p_search_query || '%'
            OR p.tags::TEXT   ILIKE '%' || p_search_query || '%'
          )
    ORDER BY p.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- get_shorts_posts_with_interactions (latest from 20241220000001)
CREATE OR REPLACE FUNCTION public.get_shorts_posts_with_interactions(
    p_current_user_id          text,
    p_limit                    integer,
    p_offset                   integer,
    p_filter_by_user_id        text DEFAULT NULL::text,
    p_filter_bookmarked_by_user_id text DEFAULT NULL::text,
    p_search_query             text DEFAULT NULL::text
)
RETURNS TABLE(
    id           uuid,
    user_id      uuid,
    created_at   timestamp with time zone,
    updated_at   timestamp with time zone,
    content_type text,
    text_content text,
    tags         text[],
    category     character varying,
    view_count   integer,
    like_count   integer,
    comment_count integer,
    share_count  integer,
    bookmark_count integer,
    access_level text,
    ppv_price_cents integer,
    metadata     jsonb,
    profiles     jsonb,
    post_media   jsonb,
    poll_results jsonb,
    user_poll_vote uuid,
    user_quiz_attempt jsonb,
    user_has_liked    boolean,
    user_has_bookmarked boolean
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_current_user_uuid           UUID;
    v_filter_by_user_uuid         UUID;
    v_filter_bookmarked_by_user_uuid UUID;
BEGIN
    BEGIN v_current_user_uuid := p_current_user_id::UUID;
    EXCEPTION WHEN invalid_text_representation THEN v_current_user_uuid := NULL; END;

    BEGIN v_filter_by_user_uuid := p_filter_by_user_id::UUID;
    EXCEPTION WHEN invalid_text_representation THEN v_filter_by_user_uuid := NULL; END;

    BEGIN v_filter_bookmarked_by_user_uuid := p_filter_bookmarked_by_user_id::UUID;
    EXCEPTION WHEN invalid_text_representation THEN v_filter_bookmarked_by_user_uuid := NULL; END;

    RETURN QUERY
    SELECT
        p.id, p.user_id, p.created_at, p.updated_at,
        p.content_type::TEXT, p.text_content, p.tags, p.category::VARCHAR(255),
        p.view_count, p.like_count, p.comment_count, p.share_count, p.bookmark_count,
        p.access_level::TEXT, p.ppv_price_cents, p.metadata,
        to_jsonb(prof) AS profiles,
        (SELECT COALESCE(jsonb_agg(pm_s.* ORDER BY pm_s.order_index ASC), '[]'::jsonb)
         FROM public.post_media pm_s WHERE pm_s.post_id = p.id) AS post_media,
        (SELECT COALESCE(jsonb_agg(json_build_object('option_id', T.selected_option_id, 'vote_count', T.vote_count)), '[]'::jsonb)
         FROM (SELECT pv_t.selected_option_id, COUNT(pv_t.id)::INTEGER AS vote_count
               FROM public.poll_votes pv_t WHERE pv_t.post_id = p.id
               GROUP BY pv_t.selected_option_id) AS T) AS poll_results,
        (SELECT pv_u.selected_option_id::UUID FROM public.poll_votes pv_u
         WHERE pv_u.post_id = p.id AND pv_u.user_id = v_current_user_uuid LIMIT 1) AS user_poll_vote,
        (SELECT to_jsonb(qa_s.*) FROM public.quiz_attempts qa_s
         WHERE qa_s.post_id = p.id AND qa_s.user_id = v_current_user_uuid
         ORDER BY qa_s.attempted_at DESC LIMIT 1) AS user_quiz_attempt,
        EXISTS(SELECT 1 FROM public.user_post_interactions upi_l
               WHERE upi_l.post_id = p.id AND upi_l.user_id = v_current_user_uuid
                 AND upi_l.interaction_type = 'post_like') AS user_has_liked,
        EXISTS(SELECT 1 FROM public.user_post_interactions upi_b
               WHERE upi_b.post_id = p.id AND upi_b.user_id = v_current_user_uuid
                 AND upi_b.interaction_type = 'post_save') AS user_has_bookmarked
    FROM public.posts p
    JOIN public.profiles prof ON p.user_id = prof.id
    LEFT JOIN public.user_post_interactions upi_bm_f
        ON v_filter_bookmarked_by_user_uuid IS NOT NULL
       AND p.id = upi_bm_f.post_id
       AND upi_bm_f.user_id = v_filter_bookmarked_by_user_uuid
       AND upi_bm_f.interaction_type = 'post_save'
    WHERE (v_filter_by_user_uuid IS NULL OR p.user_id = v_filter_by_user_uuid)
      AND (v_filter_bookmarked_by_user_uuid IS NULL OR upi_bm_f.id IS NOT NULL)
      AND p.content_type::TEXT = 'short'
      AND (p_search_query IS NULL OR p.text_content ILIKE '%' || p_search_query || '%')
    ORDER BY
        (like_count + comment_count * 2 + bookmark_count * 3) *
        CASE WHEN EXISTS(
            SELECT 1 FROM public.subscriptions s
            WHERE s.follower_id = v_current_user_uuid
              AND s.following_id = p.user_id
              AND s.status = 'active'
        ) THEN 1.2 ELSE 1.0 END DESC,
        created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- get_explore_posts_with_interactions_engagement (latest from 20241220000001)
CREATE OR REPLACE FUNCTION public.get_explore_posts_with_interactions_engagement(
    p_current_user_id          text,
    p_limit                    integer,
    p_offset                   integer,
    p_filter_by_user_id        text DEFAULT NULL::text,
    p_filter_bookmarked_by_user_id text DEFAULT NULL::text,
    p_search_query             text DEFAULT NULL::text
)
RETURNS TABLE(
    id           uuid,
    user_id      uuid,
    created_at   timestamp with time zone,
    updated_at   timestamp with time zone,
    content_type text,
    text_content text,
    tags         text[],
    category     character varying,
    view_count   integer,
    like_count   integer,
    comment_count integer,
    share_count  integer,
    bookmark_count integer,
    access_level text,
    ppv_price_cents integer,
    metadata     jsonb,
    profiles     jsonb,
    post_media   jsonb,
    poll_results jsonb,
    user_poll_vote uuid,
    user_quiz_attempt jsonb,
    user_has_liked    boolean,
    user_has_bookmarked boolean
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_current_user_uuid           UUID;
    v_filter_by_user_uuid         UUID;
    v_filter_bookmarked_by_user_uuid UUID;
BEGIN
    BEGIN v_current_user_uuid := p_current_user_id::UUID;
    EXCEPTION WHEN invalid_text_representation THEN v_current_user_uuid := NULL; END;

    BEGIN v_filter_by_user_uuid := p_filter_by_user_id::UUID;
    EXCEPTION WHEN invalid_text_representation THEN v_filter_by_user_uuid := NULL; END;

    BEGIN v_filter_bookmarked_by_user_uuid := p_filter_bookmarked_by_user_id::UUID;
    EXCEPTION WHEN invalid_text_representation THEN v_filter_bookmarked_by_user_uuid := NULL; END;

    RETURN QUERY
    SELECT
        p.id, p.user_id, p.created_at, p.updated_at,
        p.content_type::TEXT, p.text_content, p.tags, p.category::VARCHAR(255),
        p.view_count, p.like_count, p.comment_count, p.share_count, p.bookmark_count,
        p.access_level::TEXT, p.ppv_price_cents, p.metadata,
        to_jsonb(prof) AS profiles,
        (SELECT COALESCE(jsonb_agg(pm_s.* ORDER BY pm_s.order_index ASC), '[]'::jsonb)
         FROM public.post_media pm_s WHERE pm_s.post_id = p.id) AS post_media,
        (SELECT COALESCE(jsonb_agg(json_build_object('option_id', T.selected_option_id, 'vote_count', T.vote_count)), '[]'::jsonb)
         FROM (SELECT pv_t.selected_option_id, COUNT(pv_t.id)::INTEGER AS vote_count
               FROM public.poll_votes pv_t WHERE pv_t.post_id = p.id
               GROUP BY pv_t.selected_option_id) AS T) AS poll_results,
        (SELECT pv_u.selected_option_id::UUID FROM public.poll_votes pv_u
         WHERE pv_u.post_id = p.id AND pv_u.user_id = v_current_user_uuid LIMIT 1) AS user_poll_vote,
        (SELECT to_jsonb(qa_s.*) FROM public.quiz_attempts qa_s
         WHERE qa_s.post_id = p.id AND qa_s.user_id = v_current_user_uuid
         ORDER BY qa_s.attempted_at DESC LIMIT 1) AS user_quiz_attempt,
        EXISTS(SELECT 1 FROM public.user_post_interactions upi_l
               WHERE upi_l.post_id = p.id AND upi_l.user_id = v_current_user_uuid
                 AND upi_l.interaction_type = 'post_like') AS user_has_liked,
        EXISTS(SELECT 1 FROM public.user_post_interactions upi_b
               WHERE upi_b.post_id = p.id AND upi_b.user_id = v_current_user_uuid
                 AND upi_b.interaction_type = 'post_save') AS user_has_bookmarked
    FROM public.posts p
    JOIN public.profiles prof ON p.user_id = prof.id
    LEFT JOIN public.user_post_interactions upi_bm_f
        ON v_filter_bookmarked_by_user_uuid IS NOT NULL
       AND p.id = upi_bm_f.post_id
       AND upi_bm_f.user_id = v_filter_bookmarked_by_user_uuid
       AND upi_bm_f.interaction_type = 'post_save'
    WHERE (v_filter_by_user_uuid IS NULL OR p.user_id = v_filter_by_user_uuid)
      AND (v_filter_bookmarked_by_user_uuid IS NULL OR upi_bm_f.id IS NOT NULL)
      AND (
            p.content_type::TEXT IN ('image', 'video', 'carousel')
            OR EXISTS (
                SELECT 1 FROM public.post_media pm
                WHERE pm.post_id = p.id AND pm.media_type = 'short'
            )
          )
      AND (p_search_query IS NULL OR p.text_content ILIKE '%' || p_search_query || '%')
    ORDER BY
        (like_count + comment_count * 2 + bookmark_count * 3) *
        CASE WHEN EXISTS(
            SELECT 1 FROM public.subscriptions s
            WHERE s.follower_id = v_current_user_uuid
              AND s.following_id = p.user_id
              AND s.status = 'active'
        ) THEN 1.2 ELSE 1.0 END DESC,
        created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- -----------------------------------------------------------------------------
-- Profile suggestion functions
-- custom type cast 'public'::post_access_level → 'public'::public.post_access_level
-- -----------------------------------------------------------------------------

-- get_suggested_profiles (latest from 20241221000000_add_suggestions_function.sql)
CREATE OR REPLACE FUNCTION public.get_suggested_profiles(
    p_current_user_id text    DEFAULT NULL::text,
    p_limit           integer DEFAULT 10,
    p_offset          integer DEFAULT 0
)
RETURNS TABLE(
    id              uuid,
    full_name       text,
    username        text,
    bio             text,
    avatar_url      text,
    banner_url      text,
    engagement_score numeric,
    post_count      integer,
    total_likes     integer,
    total_comments  integer,
    total_bookmarks integer
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_current_user_uuid  UUID;
    v_timeframe_minutes  INTEGER;
    v_timeframe_start    TIMESTAMPTZ;
BEGIN
    BEGIN v_current_user_uuid := p_current_user_id::UUID;
    EXCEPTION WHEN invalid_text_representation THEN v_current_user_uuid := NULL; END;

    SELECT COALESCE(value::INTEGER, 1440) INTO v_timeframe_minutes
    FROM public.platform_settings WHERE key = 'suggestion_timeframe';

    v_timeframe_start := NOW() - INTERVAL '1 minute' * v_timeframe_minutes;

    RETURN QUERY
    WITH engagement_profiles AS (
        SELECT
            prof.id, prof.full_name, prof.username, prof.bio,
            prof.avatar_url, prof.banner_url, prof.updated_at,
            COALESCE(es.engagement_score, 0)::NUMERIC AS engagement_score,
            COALESCE(es.post_count,       0)::INTEGER  AS post_count,
            COALESCE(es.total_likes,      0)::INTEGER  AS total_likes,
            COALESCE(es.total_comments,   0)::INTEGER  AS total_comments,
            COALESCE(es.total_bookmarks,  0)::INTEGER  AS total_bookmarks
        FROM public.profiles prof
        LEFT JOIN (
            SELECT p.user_id,
                   COUNT(DISTINCT p.id) AS post_count,
                   COUNT(DISTINCT CASE WHEN upi_l.created_at >= v_timeframe_start THEN upi_l.id END) AS total_likes,
                   COUNT(DISTINCT CASE WHEN c.created_at   >= v_timeframe_start THEN c.id    END) AS total_comments,
                   COUNT(DISTINCT CASE WHEN upi_b.created_at >= v_timeframe_start THEN upi_b.id END) AS total_bookmarks,
                   (COUNT(DISTINCT CASE WHEN upi_l.created_at >= v_timeframe_start THEN upi_l.id END)
                    + COUNT(DISTINCT CASE WHEN c.created_at   >= v_timeframe_start THEN c.id    END) * 2
                    + COUNT(DISTINCT CASE WHEN upi_b.created_at >= v_timeframe_start THEN upi_b.id END) * 3
                   ) AS engagement_score
            FROM public.posts p
            LEFT JOIN public.user_post_interactions upi_l
                ON p.id = upi_l.post_id AND upi_l.interaction_type = 'post_like'
            LEFT JOIN public.comments c ON p.id = c.post_id
            LEFT JOIN public.user_post_interactions upi_b
                ON p.id = upi_b.post_id AND upi_b.interaction_type = 'post_save'
            WHERE p.access_level = 'public'::public.post_access_level
            GROUP BY p.user_id
        ) es ON prof.id = es.user_id
        WHERE (v_current_user_uuid IS NULL OR prof.id != v_current_user_uuid)
          AND es.engagement_score > 0
          AND prof.username IS NOT NULL AND prof.username != ''
          AND (v_current_user_uuid IS NULL OR NOT EXISTS (
                SELECT 1 FROM public.subscriptions
                WHERE follower_id = v_current_user_uuid
                  AND following_id = prof.id AND status = 'active'))
    ),
    fallback_profiles AS (
        SELECT
            prof.id, prof.full_name, prof.username, prof.bio,
            prof.avatar_url, prof.banner_url, prof.updated_at,
            0::NUMERIC AS engagement_score,
            0::INTEGER AS post_count,
            0::INTEGER AS total_likes,
            0::INTEGER AS total_comments,
            0::INTEGER AS total_bookmarks
        FROM public.profiles prof
        WHERE (v_current_user_uuid IS NULL OR prof.id != v_current_user_uuid)
          AND prof.username IS NOT NULL AND prof.username != ''
          AND (v_current_user_uuid IS NULL OR NOT EXISTS (
                SELECT 1 FROM public.subscriptions
                WHERE follower_id = v_current_user_uuid
                  AND following_id = prof.id AND status = 'active'))
          AND prof.id NOT IN (SELECT ep.id FROM engagement_profiles ep)
    )
    SELECT cp.id, cp.full_name, cp.username, cp.bio,
           cp.avatar_url, cp.banner_url,
           cp.engagement_score, cp.post_count,
           cp.total_likes, cp.total_comments, cp.total_bookmarks
    FROM (
        SELECT *, 1 AS sort_order FROM engagement_profiles
        UNION ALL
        SELECT *, 2 AS sort_order FROM fallback_profiles
    ) cp
    ORDER BY cp.sort_order ASC, cp.engagement_score DESC, cp.updated_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- get_suggested_story_profiles (only defined in initial schema)
CREATE OR REPLACE FUNCTION public.get_suggested_story_profiles(
    p_current_user_id text,
    p_limit           integer,
    p_offset          integer
)
RETURNS TABLE(
    id              uuid,
    full_name       text,
    username        text,
    bio             text,
    avatar_url      text,
    banner_url      text,
    engagement_score numeric,
    post_count      integer,
    total_likes     integer,
    total_comments  integer,
    total_bookmarks integer
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_current_user_uuid UUID;
    v_timeframe_minutes INTEGER;
    v_timeframe_start   TIMESTAMPTZ;
BEGIN
    IF p_current_user_id IS NOT NULL AND p_current_user_id != '' THEN
        BEGIN v_current_user_uuid := p_current_user_id::UUID;
        EXCEPTION WHEN invalid_text_representation THEN v_current_user_uuid := NULL; END;
    ELSE
        v_current_user_uuid := NULL;
    END IF;

    SELECT COALESCE(value::INTEGER, 1440) INTO v_timeframe_minutes
    FROM public.platform_settings WHERE key = 'suggestion_timeframe';

    v_timeframe_start := NOW() - INTERVAL '1 minute' * v_timeframe_minutes;

    RETURN QUERY
    WITH engagement_profiles AS (
        SELECT
            prof.id, prof.full_name, prof.username, prof.bio,
            prof.avatar_url, prof.banner_url, prof.updated_at,
            COALESCE(es.engagement_score, 0)::NUMERIC AS engagement_score,
            COALESCE(es.post_count,       0)::INTEGER  AS post_count,
            COALESCE(es.total_likes,      0)::INTEGER  AS total_likes,
            COALESCE(es.total_comments,   0)::INTEGER  AS total_comments,
            COALESCE(es.total_bookmarks,  0)::INTEGER  AS total_bookmarks,
            CASE WHEN v_current_user_uuid IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.subscriptions
                WHERE follower_id = v_current_user_uuid
                  AND following_id = prof.id AND status = 'active'
            ) THEN true ELSE false END AS is_subscribed
        FROM public.profiles prof
        LEFT JOIN (
            SELECT p.user_id,
                   COUNT(DISTINCT p.id) AS post_count,
                   COUNT(DISTINCT CASE WHEN upi_l.created_at >= v_timeframe_start THEN upi_l.id END) AS total_likes,
                   COUNT(DISTINCT CASE WHEN c.created_at   >= v_timeframe_start THEN c.id    END) AS total_comments,
                   COUNT(DISTINCT CASE WHEN upi_b.created_at >= v_timeframe_start THEN upi_b.id END) AS total_bookmarks,
                   (COUNT(DISTINCT CASE WHEN upi_l.created_at >= v_timeframe_start THEN upi_l.id END)
                    + COUNT(DISTINCT CASE WHEN c.created_at   >= v_timeframe_start THEN c.id    END) * 2
                    + COUNT(DISTINCT CASE WHEN upi_b.created_at >= v_timeframe_start THEN upi_b.id END) * 3
                   ) AS engagement_score
            FROM public.posts p
            LEFT JOIN public.user_post_interactions upi_l
                ON p.id = upi_l.post_id AND upi_l.interaction_type = 'post_like'
            LEFT JOIN public.comments c ON p.id = c.post_id
            LEFT JOIN public.user_post_interactions upi_b
                ON p.id = upi_b.post_id AND upi_b.interaction_type = 'post_save'
            WHERE p.access_level = 'public'::public.post_access_level
            GROUP BY p.user_id
        ) es ON prof.id = es.user_id
        WHERE (v_current_user_uuid IS NULL OR prof.id != v_current_user_uuid)
          AND es.engagement_score > 0
          AND prof.username IS NOT NULL AND prof.username != ''
    ),
    fallback_profiles AS (
        SELECT
            prof.id, prof.full_name, prof.username, prof.bio,
            prof.avatar_url, prof.banner_url, prof.updated_at,
            0::NUMERIC AS engagement_score,
            0::INTEGER AS post_count,
            0::INTEGER AS total_likes,
            0::INTEGER AS total_comments,
            0::INTEGER AS total_bookmarks,
            CASE WHEN v_current_user_uuid IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.subscriptions
                WHERE follower_id = v_current_user_uuid
                  AND following_id = prof.id AND status = 'active'
            ) THEN true ELSE false END AS is_subscribed
        FROM public.profiles prof
        WHERE (v_current_user_uuid IS NULL OR prof.id != v_current_user_uuid)
          AND prof.username IS NOT NULL AND prof.username != ''
          AND prof.id NOT IN (SELECT ep.id FROM engagement_profiles ep)
    )
    SELECT cp.id, cp.full_name, cp.username, cp.bio,
           cp.avatar_url, cp.banner_url,
           cp.engagement_score, cp.post_count,
           cp.total_likes, cp.total_comments, cp.total_bookmarks
    FROM (
        SELECT *, 1 AS sort_order FROM engagement_profiles
        UNION ALL
        SELECT *, 2 AS sort_order FROM fallback_profiles
    ) cp
    ORDER BY
        cp.is_subscribed DESC,
        CASE WHEN LENGTH(cp.username) < 15 THEN 0 ELSE 1 END ASC,
        cp.sort_order ASC,
        cp.engagement_score DESC,
        cp.updated_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- -----------------------------------------------------------------------------
-- RLS helper functions (bodies already use public.*; only search_path changes)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p."isAdmin" = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_conversation_participant(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = p_conversation_id AND cp.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_add_conversation_participant(
    p_conversation_id uuid,
    p_user_id         uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    p_user_id = auth.uid()
    OR (
      EXISTS (SELECT 1 FROM public.conversations c
              WHERE c.id = p_conversation_id AND c.is_group = false)
      AND (
        EXISTS (SELECT 1 FROM public.conversation_participants cp
                WHERE cp.conversation_id = p_conversation_id AND cp.user_id = auth.uid())
        OR NOT EXISTS (SELECT 1 FROM public.conversation_participants cp
                       WHERE cp.conversation_id = p_conversation_id)
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.owns_creator_product(p_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.creator_products cp
    WHERE cp.id = p_product_id AND cp.creator_profile_id = auth.uid()
  );
$$;

-- -----------------------------------------------------------------------------
-- Credit functions (bodies already use public.*; only search_path changes)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.debit_credits_if_sufficient(p_user_id uuid, p_credits integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

CREATE OR REPLACE FUNCTION public.refund_credits(p_user_id uuid, p_credits integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF p_credits IS NULL OR p_credits < 1 THEN RETURN; END IF;
    UPDATE public.profiles SET credits = credits + p_credits WHERE id = p_user_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- Communication history (body already uses public.*; only search_path changes)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_combined_communication_history(
    p_user_id          uuid,
    p_target_profile_id uuid,
    p_limit            integer
)
RETURNS TABLE(
    id                uuid,
    content           text,
    media_description text,
    created_at        timestamptz,
    sender_id         uuid,
    is_user           boolean,
    type              text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    (
        SELECT m.id, m.content, m.media_description, m.created_at,
               m.sender_id, (m.sender_id = p_user_id) AS is_user, 'message'::text
        FROM public.messages m
        WHERE m.conversation_id = (
            SELECT cp.conversation_id
            FROM public.conversation_participants cp
            GROUP BY cp.conversation_id
            HAVING count(cp.user_id) = 2
               AND count(CASE WHEN cp.user_id IN (p_user_id, p_target_profile_id) THEN 1 END) = 2
            LIMIT 1
        )
    )
    UNION ALL
    (
        SELECT ct.id, ct.content, NULL::text, ct.created_at,
               NULL::uuid, ct.is_user, 'transcript'::text
        FROM public.call_transcripts ct
        WHERE (ct.user_id = p_user_id AND ct.creator_profile_id = p_target_profile_id)
           OR (ct.user_id = p_target_profile_id AND ct.creator_profile_id = p_user_id)
    )
    ORDER BY created_at DESC
    LIMIT p_limit;
END;
$$;
