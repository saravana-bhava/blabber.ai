-- =============================================================================
-- Initial schema (baseline before incremental migrations)
-- Generated from backups/20250813-165133/full.sql — re-run:
--   node scripts/extract-baseline-migration.mjs
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

CREATE TYPE "public"."creator_onboarding_status" AS ENUM (
    'not_started',
    'pending',
    'incomplete',
    'completed',
    'rejected',
    'restricted',
    'in_progress'
);


ALTER TYPE "public"."creator_onboarding_status" OWNER TO "postgres";


CREATE TYPE "public"."media_item_type" AS ENUM (
    'image',
    'video',
    'live_stream',
    'short'
);


ALTER TYPE "public"."media_item_type" OWNER TO "postgres";


CREATE TYPE "public"."post_access_level" AS ENUM (
    'public',
    'subscribers_only',
    'ppv'
);


ALTER TYPE "public"."post_access_level" OWNER TO "postgres";


CREATE TYPE "public"."post_content_type" AS ENUM (
    'text_only',
    'image',
    'video',
    'carousel',
    'poll',
    'quiz',
    'live_stream',
    'short'
);


ALTER TYPE "public"."post_content_type" OWNER TO "postgres";


CREATE TYPE "public"."subscription_interval" AS ENUM (
    'month',
    'year',
    'week'
);


ALTER TYPE "public"."subscription_interval" OWNER TO "postgres";


CREATE TYPE "public"."subscription_status" AS ENUM (
    'active',
    'trialing',
    'past_due',
    'canceled',
    'ended',
    'incomplete'
);


ALTER TYPE "public"."subscription_status" OWNER TO "postgres";


CREATE TYPE "public"."user_interaction_type" AS ENUM (
    'post_view',
    'post_like',
    'post_save',
    'comment_made',
    'poll_vote',
    'quiz_attempt',
    'quiz_completion',
    'video_play_started',
    'video_progress_25',
    'video_progress_50',
    'video_progress_75',
    'video_playback_completed',
    'comment_like'
);


ALTER TYPE "public"."user_interaction_type" OWNER TO "postgres";



CREATE OR REPLACE FUNCTION "public"."after_conversation_last_message_update_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RAISE WARNING 'after_conversation_last_message_update_trigger fired for conversation_id: %', NEW.id;
  PERFORM update_has_unread_msg_for_conversation(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."after_last_read_update_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Call the update function for the conversation
  PERFORM update_has_unread_msg_for_conversation(NEW.conversation_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_actor_id" "uuid", "p_notification_type" "text", "p_title" "text", "p_body" "text", "p_data" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO notifications (
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

CREATE OR REPLACE FUNCTION "public"."decrement_bookmark_count"("p_post_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
    DECLARE
      new_bookmark_count INTEGER;
    BEGIN
      UPDATE posts
      SET bookmark_count = GREATEST(0, bookmark_count - 1) -- Prevent negative counts
      WHERE id = p_post_id
      RETURNING bookmark_count INTO new_bookmark_count;
      RETURN new_bookmark_count;
    END;
    $$;

CREATE OR REPLACE FUNCTION "public"."decrement_comment_like_count"("p_comment_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
    DECLARE
      new_like_count INTEGER;
    BEGIN
      UPDATE public.comments
      SET like_count = GREATEST(0, like_count - 1) -- Prevent negative counts
      WHERE id = p_comment_id
      RETURNING like_count INTO new_like_count;
      RETURN new_like_count;
    END;
    $$;

CREATE OR REPLACE FUNCTION "public"."decrement_like_count"("p_post_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
    DECLARE
      new_like_count INTEGER;
    BEGIN
      UPDATE posts
      SET like_count = GREATEST(0, like_count - 1) -- Prevent negative counts
      WHERE id = p_post_id
      RETURNING like_count INTO new_like_count;
      RETURN new_like_count;
    END;
    $$;

CREATE OR REPLACE FUNCTION "public"."enforce_post_monetization_rules"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    creator_can_monetize boolean;
BEGIN
    -- Check for monetized post types
    IF (NEW.access_level = 'subscribers_only' OR NEW.access_level = 'ppv') THEN
        SELECT c.can_monetize INTO creator_can_monetize
        FROM public.creators c
        WHERE c.profile_id = NEW.user_id;

        IF NOT FOUND OR creator_can_monetize IS NOT TRUE THEN
            RAISE EXCEPTION 'User (profile_id: %) is not authorized to create monetized posts (subscribers_only or ppv), or has not completed creator onboarding.', NEW.user_id;
        END IF;
    END IF;

    -- Check PPV price consistency (this logic is also in the CHECK constraint but trigger provides better error context)
    IF NEW.access_level = 'ppv' THEN
        IF (NEW.ppv_price_cents IS NULL OR NEW.ppv_price_cents <= 0) THEN
            RAISE EXCEPTION 'PPV posts must have a valid price (ppv_price_cents > 0).';
        END IF;
    ELSE -- For 'public' or 'subscribers_only' posts
        IF NEW.ppv_price_cents IS NOT NULL THEN
            RAISE EXCEPTION 'Only PPV posts can have a price. For % posts, ppv_price_cents must be NULL.', NEW.access_level;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."generate_random_username"("length" integer DEFAULT 16) RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    result text := '';
    i integer := 0;
BEGIN
    FOR i IN 1..length LOOP
        result := result || substr(chars, floor(random() * length(chars))::integer + 1, 1);
    END LOOP;
    RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."get_explore_posts_with_interactions"("p_current_user_id" "text", "p_limit" integer, "p_offset" integer, "p_filter_by_user_id" "text" DEFAULT NULL::"text", "p_filter_bookmarked_by_user_id" "text" DEFAULT NULL::"text", "p_search_query" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "user_id" "uuid", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "content_type" "text", "text_content" "text", "tags" "text"[], "category" character varying, "view_count" integer, "like_count" integer, "comment_count" integer, "share_count" integer, "bookmark_count" integer, "access_level" "text", "ppv_price_cents" integer, "metadata" "jsonb", "profiles" "jsonb", "post_media" "jsonb", "poll_results" "jsonb", "user_poll_vote" "uuid", "user_quiz_attempt" "jsonb", "user_has_liked" boolean, "user_has_bookmarked" boolean)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_current_user_uuid UUID;
    v_filter_by_user_uuid UUID;
    v_filter_bookmarked_by_user_uuid UUID;
BEGIN
    IF p_current_user_id IS NOT NULL THEN
        BEGIN
            v_current_user_uuid := p_current_user_id::UUID;
        EXCEPTION WHEN invalid_text_representation THEN
            v_current_user_uuid := NULL;
        END;
    ELSE
        v_current_user_uuid := NULL;
    END IF;

    IF p_filter_by_user_id IS NOT NULL THEN
        BEGIN
            v_filter_by_user_uuid := p_filter_by_user_id::UUID;
        EXCEPTION WHEN invalid_text_representation THEN
            v_filter_by_user_uuid := NULL;
        END;
    ELSE
        v_filter_by_user_uuid := NULL;
    END IF;

    IF p_filter_bookmarked_by_user_id IS NOT NULL THEN
        BEGIN
            v_filter_bookmarked_by_user_uuid := p_filter_bookmarked_by_user_id::UUID;
        EXCEPTION WHEN invalid_text_representation THEN
            v_filter_bookmarked_by_user_uuid := NULL;
        END;
    ELSE
        v_filter_bookmarked_by_user_uuid := NULL;
    END IF;

    RETURN QUERY
    SELECT
        p.id,
        p.user_id,
        p.created_at,
        p.updated_at,
        p.content_type::TEXT,
        p.text_content,
        p.tags,
        p.category::VARCHAR(255),
        p.view_count,
        p.like_count,
        p.comment_count,
        p.share_count,
        p.bookmark_count,
        p.access_level::TEXT,
        p.ppv_price_cents,
        p.metadata,
        to_jsonb(prof) AS profiles,
        (
            SELECT COALESCE(jsonb_agg(pm_select.* ORDER BY pm_select.order_index ASC), '[]'::jsonb)
            FROM post_media pm_select
            WHERE pm_select.post_id = p.id
        ) AS post_media,
        (
            SELECT COALESCE(jsonb_agg(json_build_object('option_id', T.selected_option_id, 'vote_count', T.vote_count)), '[]'::jsonb)
            FROM (
                SELECT selected_option_id, COUNT(poll_votes.id)::INTEGER as vote_count
                FROM poll_votes
                WHERE post_id = p.id
                GROUP BY selected_option_id
            ) AS T
        ) as poll_results,
        (
            SELECT pv_user_select.selected_option_id::UUID
            FROM poll_votes pv_user_select
            WHERE pv_user_select.post_id = p.id AND pv_user_select.user_id = v_current_user_uuid
            LIMIT 1
        ) AS user_poll_vote,
        (
            SELECT to_jsonb(qa_select.*)
            FROM quiz_attempts qa_select
            WHERE qa_select.post_id = p.id AND qa_select.user_id = v_current_user_uuid
            ORDER BY qa_select.attempted_at DESC
            LIMIT 1
        ) AS user_quiz_attempt,
        EXISTS (
            SELECT 1
            FROM user_post_interactions upi_like_select
            WHERE upi_like_select.post_id = p.id AND upi_like_select.user_id = v_current_user_uuid AND upi_like_select.interaction_type = 'post_like'
        ) AS user_has_liked,
        EXISTS (
            SELECT 1
            FROM user_post_interactions upi_bm_select
            WHERE upi_bm_select.post_id = p.id AND upi_bm_select.user_id = v_current_user_uuid AND upi_bm_select.interaction_type = 'post_save'
        ) AS user_has_bookmarked
    FROM
        posts p
    JOIN
        profiles prof ON p.user_id = prof.id
    LEFT JOIN
        user_post_interactions upi_bookmark_filter
        ON v_filter_bookmarked_by_user_uuid IS NOT NULL AND p.id = upi_bookmark_filter.post_id
           AND upi_bookmark_filter.user_id = v_filter_bookmarked_by_user_uuid
           AND upi_bookmark_filter.interaction_type = 'post_save'
    WHERE
        (v_filter_by_user_uuid IS NULL OR p.user_id = v_filter_by_user_uuid)
    AND
        (v_filter_bookmarked_by_user_uuid IS NULL OR upi_bookmark_filter.id IS NOT NULL)
    AND
        -- For explore, include visual content types: image, video, carousel, and posts with short media
        (p.content_type::TEXT IN ('image', 'video', 'carousel') 
         OR EXISTS (
             SELECT 1 
             FROM post_media pm 
             WHERE pm.post_id = p.id AND pm.media_type = 'short'
         ))
    AND
        -- Enhanced search functionality
        (p_search_query IS NULL OR 
         p.text_content ILIKE '%' || p_search_query || '%' OR
         prof.username ILIKE '%' || p_search_query || '%' OR
         prof.full_name ILIKE '%' || p_search_query || '%' OR
         p.tags::TEXT ILIKE '%' || p_search_query || '%')
    ORDER BY
        p.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."get_explore_posts_with_interactions_engagement"("p_current_user_id" "text", "p_limit" integer, "p_offset" integer, "p_filter_by_user_id" "text" DEFAULT NULL::"text", "p_filter_bookmarked_by_user_id" "text" DEFAULT NULL::"text", "p_search_query" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "user_id" "uuid", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "content_type" "text", "text_content" "text", "tags" "text"[], "category" character varying, "view_count" integer, "like_count" integer, "comment_count" integer, "share_count" integer, "bookmark_count" integer, "access_level" "text", "ppv_price_cents" integer, "metadata" "jsonb", "profiles" "jsonb", "post_media" "jsonb", "poll_results" "jsonb", "user_poll_vote" "uuid", "user_quiz_attempt" "jsonb", "user_has_liked" boolean, "user_has_bookmarked" boolean)
    LANGUAGE "plpgsql"
    AS $$DECLARE
    v_current_user_uuid UUID;
    v_filter_by_user_uuid UUID;
    v_filter_bookmarked_by_user_uuid UUID;
    v_like_weight INTEGER;
    v_comment_weight INTEGER;
    v_bookmark_weight INTEGER;
    v_subs_weight DECIMAL(3,2);
BEGIN
    -- Get algorithm weights from platform_settings
    SELECT 
        algo_like_weight,
        algo_comment_weight,
        algo_bookmark_weight,
        algo_subs_weight
    INTO 
        v_like_weight,
        v_comment_weight,
        v_bookmark_weight,
        v_subs_weight
    FROM platform_settings 
    LIMIT 1;

    -- Set defaults if no settings found
    v_like_weight := COALESCE(v_like_weight, 1);
    v_comment_weight := COALESCE(v_comment_weight, 2);
    v_bookmark_weight := COALESCE(v_bookmark_weight, 3);
    v_subs_weight := COALESCE(v_subs_weight, 1.20);

    IF p_current_user_id IS NOT NULL THEN
        BEGIN
            v_current_user_uuid := p_current_user_id::UUID;
        EXCEPTION WHEN invalid_text_representation THEN
            v_current_user_uuid := NULL;
        END;
    ELSE
        v_current_user_uuid := NULL;
    END IF;

    IF p_filter_by_user_id IS NOT NULL THEN
        BEGIN
            v_filter_by_user_uuid := p_filter_by_user_id::UUID;
        EXCEPTION WHEN invalid_text_representation THEN
            v_filter_by_user_uuid := NULL;
        END;
    ELSE
        v_filter_by_user_uuid := NULL;
    END IF;

    IF p_filter_bookmarked_by_user_id IS NOT NULL THEN
        BEGIN
            v_filter_bookmarked_by_user_uuid := p_filter_bookmarked_by_user_id::UUID;
        EXCEPTION WHEN invalid_text_representation THEN
            v_filter_bookmarked_by_user_uuid := NULL;
        END;
    ELSE
        v_filter_bookmarked_by_user_uuid := NULL;
    END IF;

    RETURN QUERY
    SELECT
        p.id,
        p.user_id,
        p.created_at,
        p.updated_at,
        p.content_type::TEXT,
        p.text_content,
        p.tags,
        p.category::VARCHAR(255),
        p.view_count,
        p.like_count,
        p.comment_count,
        p.share_count,
        p.bookmark_count,
        p.access_level::TEXT,
        p.ppv_price_cents,
        p.metadata,
        to_jsonb(prof) AS profiles,
        (
            SELECT COALESCE(jsonb_agg(pm_select.* ORDER BY pm_select.order_index ASC), '[]'::jsonb)
            FROM post_media pm_select
            WHERE pm_select.post_id = p.id
        ) AS post_media,
        (
            SELECT COALESCE(jsonb_agg(json_build_object('option_id', T.selected_option_id, 'vote_count', T.vote_count)), '[]'::jsonb)
            FROM (
                SELECT selected_option_id, COUNT(poll_votes.id)::INTEGER as vote_count
                FROM poll_votes
                WHERE post_id = p.id
                GROUP BY selected_option_id
            ) AS T
        ) as poll_results,
        (
            SELECT pv_user_select.selected_option_id::UUID
            FROM poll_votes pv_user_select
            WHERE pv_user_select.post_id = p.id AND pv_user_select.user_id = v_current_user_uuid
            LIMIT 1
        ) AS user_poll_vote,
        (
            SELECT to_jsonb(qa_select.*)
            FROM quiz_attempts qa_select
            WHERE qa_select.post_id = p.id AND qa_select.user_id = v_current_user_uuid
            ORDER BY qa_select.attempted_at DESC
            LIMIT 1
        ) AS user_quiz_attempt,
        EXISTS (
            SELECT 1
            FROM user_post_interactions upi_like_select
            WHERE upi_like_select.post_id = p.id AND upi_like_select.user_id = v_current_user_uuid AND upi_like_select.interaction_type = 'post_like'
        ) AS user_has_liked,
        EXISTS (
            SELECT 1
            FROM user_post_interactions upi_bm_select
            WHERE upi_bm_select.post_id = p.id AND upi_bm_select.user_id = v_current_user_uuid AND upi_bm_select.interaction_type = 'post_save'
        ) AS user_has_bookmarked
    FROM
        posts p
    JOIN
        profiles prof ON p.user_id = prof.id
    LEFT JOIN
        user_post_interactions upi_bookmark_filter
        ON v_filter_bookmarked_by_user_uuid IS NOT NULL AND p.id = upi_bookmark_filter.post_id
           AND upi_bookmark_filter.user_id = v_filter_bookmarked_by_user_uuid
           AND upi_bookmark_filter.interaction_type = 'post_save'
    WHERE
        (v_filter_by_user_uuid IS NULL OR p.user_id = v_filter_by_user_uuid)
    AND
        (v_filter_bookmarked_by_user_uuid IS NULL OR upi_bookmark_filter.id IS NOT NULL)
    AND
        -- More inclusive filtering for explore - include all visual content types
        (p.content_type::TEXT IN ('image', 'video', 'carousel', 'short') 
         OR EXISTS (
             SELECT 1 
             FROM post_media pm 
             WHERE pm.post_id = p.id 
             AND pm.media_type IN ('image', 'video', 'short')
         ))
    AND (
        p_search_query IS NULL
        OR p.text_content ILIKE '%' || p_search_query || '%'
        OR prof.username ILIKE '%' || p_search_query || '%'
        OR prof.full_name ILIKE '%' || p_search_query || '%'
        OR EXISTS (
            SELECT 1 FROM unnest(p.tags) AS tag WHERE tag ILIKE '%' || p_search_query || '%'
        )
    )
    ORDER BY 
        (p.like_count * v_like_weight + p.comment_count * v_comment_weight + p.bookmark_count * v_bookmark_weight) * 
        CASE WHEN EXISTS(
            SELECT 1 FROM subscriptions 
            WHERE follower_id = v_current_user_uuid 
            AND following_id = p.user_id 
            AND status = 'active'
        ) THEN v_subs_weight ELSE 1.0 END 
    DESC, p.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;$$;

CREATE OR REPLACE FUNCTION "public"."get_feed_posts_with_interactions"("p_user_id" "uuid", "p_limit" integer, "p_offset" integer) RETURNS TABLE("id" "uuid", "user_id" "uuid", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "content_type" "public"."post_content_type", "text_content" "text", "tags" "text"[], "category" "text", "view_count" integer, "like_count" integer, "comment_count" integer, "share_count" integer, "bookmark_count" integer, "access_level" "public"."post_access_level", "ppv_price_cents" integer, "metadata" "jsonb", "profiles" "jsonb", "post_media" "jsonb", "poll_results" "jsonb", "user_poll_vote" "text", "user_quiz_attempt" "jsonb", "user_has_liked" boolean, "user_has_bookmarked" boolean)
    LANGUAGE "plpgsql"
    AS $$
    BEGIN
        RETURN QUERY
        SELECT
            p.id,
            p.user_id,
            p.created_at,
            p.updated_at,
            p.content_type,
            p.text_content,
            p.tags,
            p.category,
            p.view_count,
            p.like_count,
            p.comment_count,
            p.share_count,
            p.bookmark_count, -- Selected from posts table
            p.access_level,
            p.ppv_price_cents,
            p.metadata,
            to_jsonb(prof) AS profiles,
            (
                SELECT COALESCE(jsonb_agg(pm.* ORDER BY pm.order_index ASC), '[]'::jsonb)
                FROM post_media pm
                WHERE pm.post_id = p.id
            ) AS post_media,
            (
                SELECT COALESCE(jsonb_agg(pr.*), '[]'::jsonb)
                FROM (
                    SELECT
                        pv.selected_option_id AS option_id,
                        COUNT(pv.id)::INTEGER AS vote_count
                    FROM poll_votes pv
                    WHERE pv.post_id = p.id
                    GROUP BY pv.selected_option_id
                ) pr
            ) AS poll_results,
            (
                SELECT pv.selected_option_id
                FROM poll_votes pv
                WHERE pv.post_id = p.id AND pv.user_id = p_user_id
                LIMIT 1
            ) AS user_poll_vote,
            (
                SELECT to_jsonb(qa.*)
                FROM quiz_attempts qa
                WHERE qa.post_id = p.id AND qa.user_id = p_user_id
                ORDER BY qa.attempted_at DESC
                LIMIT 1
            ) AS user_quiz_attempt,
            EXISTS (
                SELECT 1
                FROM user_post_interactions upi
                WHERE upi.post_id = p.id AND upi.user_id = p_user_id AND upi.interaction_type = 'post_like'
            ) AS user_has_liked,
            EXISTS (
                SELECT 1
                FROM user_post_interactions upi
                WHERE upi.post_id = p.id AND upi.user_id = p_user_id AND upi.interaction_type = 'post_save'
            ) AS user_has_bookmarked
        FROM
            posts p
        JOIN
            profiles prof ON p.user_id = prof.id
        ORDER BY
            p.created_at DESC
        LIMIT p_limit
        OFFSET p_offset;
    END;
    $$;

CREATE OR REPLACE FUNCTION "public"."get_feed_posts_with_interactions"("p_current_user_id" "text", "p_limit" integer, "p_offset" integer, "p_filter_by_user_id" "text" DEFAULT NULL::"text", "p_filter_bookmarked_by_user_id" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "user_id" "uuid", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "content_type" "text", "text_content" "text", "tags" "text"[], "category" "text", "view_count" integer, "like_count" integer, "comment_count" integer, "share_count" integer, "bookmark_count" integer, "access_level" "text", "ppv_price_cents" integer, "metadata" "jsonb", "profiles" "jsonb", "post_media" "jsonb", "poll_results" "jsonb", "user_poll_vote" "text", "user_quiz_attempt" "jsonb", "user_has_liked" boolean, "user_has_bookmarked" boolean)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_current_user_uuid UUID;
    v_filter_by_user_uuid UUID;
    v_filter_bookmarked_by_user_uuid UUID;
BEGIN
    IF p_current_user_id IS NOT NULL THEN
        BEGIN
            v_current_user_uuid := p_current_user_id::UUID;
        EXCEPTION WHEN invalid_text_representation THEN
            v_current_user_uuid := NULL;
        END;
    ELSE
        v_current_user_uuid := NULL;
    END IF;

    IF p_filter_by_user_id IS NOT NULL THEN
        BEGIN
            v_filter_by_user_uuid := p_filter_by_user_id::UUID;
        EXCEPTION WHEN invalid_text_representation THEN
            v_filter_by_user_uuid := NULL;
        END;
    ELSE
        v_filter_by_user_uuid := NULL;
    END IF;

    IF p_filter_bookmarked_by_user_id IS NOT NULL THEN
        BEGIN
            v_filter_bookmarked_by_user_uuid := p_filter_bookmarked_by_user_id::UUID;
        EXCEPTION WHEN invalid_text_representation THEN
            v_filter_bookmarked_by_user_uuid := NULL;
        END;
    ELSE
        v_filter_bookmarked_by_user_uuid := NULL;
    END IF;

    RETURN QUERY
    SELECT
        p.id,
        p.user_id,
        p.created_at,
        p.updated_at,
        p.content_type::TEXT,  -- Explicit cast
        p.text_content,
        p.tags,
        p.category,
        p.view_count,
        p.like_count,
        p.comment_count,
        p.share_count,
        p.bookmark_count,
        p.access_level::TEXT,  -- Explicit cast
        p.ppv_price_cents,
        p.metadata,
        to_jsonb(prof) AS profiles,
        (
            SELECT COALESCE(jsonb_agg(pm_select.* ORDER BY pm_select.order_index ASC), '[]'::jsonb)
            FROM post_media pm_select
            WHERE pm_select.post_id = p.id
        ) AS post_media,
        (
            SELECT COALESCE(jsonb_agg(pr_select.*), '[]'::jsonb)
            FROM (
                SELECT
                    pv_select.selected_option_id AS option_id,
                    COUNT(pv_select.id)::INTEGER AS vote_count
                FROM poll_votes pv_select
                WHERE pv_select.post_id = p.id
                GROUP BY pv_select.selected_option_id
            ) pr_select
        ) AS poll_results,
        (
            SELECT pv_user_select.selected_option_id
            FROM poll_votes pv_user_select
            WHERE pv_user_select.post_id = p.id AND pv_user_select.user_id = v_current_user_uuid
            LIMIT 1
        ) AS user_poll_vote,
        (
            SELECT to_jsonb(qa_select.*)
            FROM quiz_attempts qa_select
            WHERE qa_select.post_id = p.id AND qa_select.user_id = v_current_user_uuid
            ORDER BY qa_select.attempted_at DESC
            LIMIT 1
        ) AS user_quiz_attempt,
        EXISTS (
            SELECT 1
            FROM user_post_interactions upi_like_select
            WHERE upi_like_select.post_id = p.id AND upi_like_select.user_id = v_current_user_uuid AND upi_like_select.interaction_type = 'post_like'
        ) AS user_has_liked,
        EXISTS (
            SELECT 1
            FROM user_post_interactions upi_bm_select
            WHERE upi_bm_select.post_id = p.id AND upi_bm_select.user_id = v_current_user_uuid AND upi_bm_select.interaction_type = 'post_save'
        ) AS user_has_bookmarked
    FROM
        posts p
    JOIN
        profiles prof ON p.user_id = prof.id
    LEFT JOIN
        user_post_interactions upi_bookmark_filter
        ON v_filter_bookmarked_by_user_uuid IS NOT NULL AND p.id = upi_bookmark_filter.post_id
           AND upi_bookmark_filter.user_id = v_filter_bookmarked_by_user_uuid
           AND upi_bookmark_filter.interaction_type = 'post_save'
    WHERE
        (v_filter_by_user_uuid IS NULL OR p.user_id = v_filter_by_user_uuid)
    AND
        (v_filter_bookmarked_by_user_uuid IS NULL OR upi_bookmark_filter.id IS NOT NULL)
    ORDER BY
        p.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."get_feed_posts_with_interactions"("p_current_user_id" "text", "p_limit" integer, "p_offset" integer, "p_filter_by_user_id" "text" DEFAULT NULL::"text", "p_filter_bookmarked_by_user_id" "text" DEFAULT NULL::"text", "p_content_type" "text" DEFAULT NULL::"text", "p_search_query" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "user_id" "uuid", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "content_type" "text", "text_content" "text", "tags" "text"[], "category" character varying, "view_count" integer, "like_count" integer, "comment_count" integer, "share_count" integer, "bookmark_count" integer, "access_level" "text", "ppv_price_cents" integer, "metadata" "jsonb", "profiles" "jsonb", "post_media" "jsonb", "poll_results" "jsonb", "user_poll_vote" "uuid", "user_quiz_attempt" "jsonb", "user_has_liked" boolean, "user_has_bookmarked" boolean)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_current_user_uuid UUID;
    v_filter_by_user_uuid UUID;
    v_filter_bookmarked_by_user_uuid UUID;
BEGIN
    IF p_current_user_id IS NOT NULL THEN
        BEGIN
            v_current_user_uuid := p_current_user_id::UUID;
        EXCEPTION WHEN invalid_text_representation THEN
            v_current_user_uuid := NULL;
        END;
    ELSE
        v_current_user_uuid := NULL;
    END IF;

    IF p_filter_by_user_id IS NOT NULL THEN
        BEGIN
            v_filter_by_user_uuid := p_filter_by_user_id::UUID;
        EXCEPTION WHEN invalid_text_representation THEN
            v_filter_by_user_uuid := NULL;
        END;
    ELSE
        v_filter_by_user_uuid := NULL;
    END IF;

    IF p_filter_bookmarked_by_user_id IS NOT NULL THEN
        BEGIN
            v_filter_bookmarked_by_user_uuid := p_filter_bookmarked_by_user_id::UUID;
        EXCEPTION WHEN invalid_text_representation THEN
            v_filter_bookmarked_by_user_uuid := NULL;
        END;
    ELSE
        v_filter_bookmarked_by_user_uuid := NULL;
    END IF;

    RETURN QUERY
    SELECT
        p.id,
        p.user_id,
        p.created_at,
        p.updated_at,
        p.content_type::TEXT,
        p.text_content,
        p.tags,
        p.category::VARCHAR(255),
        p.view_count,
        p.like_count,
        p.comment_count,
        p.share_count,
        p.bookmark_count,
        p.access_level::TEXT,
        p.ppv_price_cents,
        p.metadata,
        to_jsonb(prof) AS profiles,
        (
            SELECT COALESCE(jsonb_agg(pm_select.* ORDER BY pm_select.order_index ASC), '[]'::jsonb)
            FROM post_media pm_select
            WHERE pm_select.post_id = p.id
        ) AS post_media,
        (
            SELECT COALESCE(jsonb_agg(json_build_object('option_id', T.selected_option_id, 'vote_count', T.vote_count)), '[]'::jsonb)
            FROM (
                SELECT selected_option_id, COUNT(poll_votes.id)::INTEGER as vote_count
                FROM poll_votes
                WHERE post_id = p.id
                GROUP BY selected_option_id
            ) AS T
        ) as poll_results,
        (
            SELECT pv_user_select.selected_option_id::UUID
            FROM poll_votes pv_user_select
            WHERE pv_user_select.post_id = p.id AND pv_user_select.user_id = v_current_user_uuid
            LIMIT 1
        ) AS user_poll_vote,
        (
            SELECT to_jsonb(qa_select.*)
            FROM quiz_attempts qa_select
            WHERE qa_select.post_id = p.id AND qa_select.user_id = v_current_user_uuid
            ORDER BY qa_select.attempted_at DESC
            LIMIT 1
        ) AS user_quiz_attempt,
        EXISTS (
            SELECT 1
            FROM user_post_interactions upi_like_select
            WHERE upi_like_select.post_id = p.id AND upi_like_select.user_id = v_current_user_uuid AND upi_like_select.interaction_type = 'post_like'
        ) AS user_has_liked,
        EXISTS (
            SELECT 1
            FROM user_post_interactions upi_bm_select
            WHERE upi_bm_select.post_id = p.id AND upi_bm_select.user_id = v_current_user_uuid AND upi_bm_select.interaction_type = 'post_save'
        ) AS user_has_bookmarked
    FROM
        posts p
    JOIN
        profiles prof ON p.user_id = prof.id
    LEFT JOIN
        user_post_interactions upi_bookmark_filter
        ON v_filter_bookmarked_by_user_uuid IS NOT NULL AND p.id = upi_bookmark_filter.post_id
           AND upi_bookmark_filter.user_id = v_filter_bookmarked_by_user_uuid
           AND upi_bookmark_filter.interaction_type = 'post_save'
    WHERE
        (v_filter_by_user_uuid IS NULL OR p.user_id = v_filter_by_user_uuid)
    AND
        (v_filter_bookmarked_by_user_uuid IS NULL OR upi_bookmark_filter.id IS NOT NULL)
    AND
        (CASE
            WHEN p_content_type IS NOT NULL THEN p.content_type::TEXT = p_content_type
            ELSE p.content_type::TEXT <> 'short'
        END)
    AND
        (p_search_query IS NULL OR p.text_content ILIKE '%' || p_search_query || '%')
    ORDER BY
        p.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."get_monthly_financials"("p_month" integer, "p_year" integer) RETURNS TABLE("gross_revenue" numeric, "net_revenue" numeric, "creator_payouts" numeric, "platform_fees" numeric, "total_transactions" bigint)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    start_date TIMESTAMPTZ;
    end_date TIMESTAMPTZ;
BEGIN
    -- Set the start and end dates for the given month and year
    start_date := make_timestamptz(p_year, p_month, 1, 0, 0, 0);
    end_date := start_date + interval '1 month';

    RETURN QUERY
    WITH all_transactions AS (
        -- Union all transaction types into a single set for aggregation
        SELECT amount_cents, platform_share_cents, creator_share_cents FROM tip_transactions WHERE created_at >= start_date AND created_at < end_date
        UNION ALL
        SELECT amount_cents, platform_share_cents, creator_share_cents FROM ppv_transactions WHERE created_at >= start_date AND created_at < end_date
        UNION ALL
        SELECT amount_cents, platform_share_cents, creator_share_cents FROM subscription_payments WHERE created_at >= start_date AND created_at < end_date
        UNION ALL
        SELECT amount_cents, platform_share_cents, creator_share_cents FROM creator_product_transactions WHERE created_at >= start_date AND created_at < end_date
        UNION ALL
        -- Credit purchases are 100% platform revenue
        SELECT amount_cents, amount_cents AS platform_share_cents, 0 AS creator_share_cents FROM credit_transactions WHERE created_at >= start_date AND created_at < end_date
    )
    SELECT
        -- Gross Revenue: Sum of all transaction amounts before any splits
        COALESCE(SUM(t.amount_cents), 0)::NUMERIC AS gross_revenue,
        -- Net Revenue: The platform's share from all transactions
        COALESCE(SUM(t.platform_share_cents), 0)::NUMERIC AS net_revenue,
        -- Creator Payouts: The creators' share from all transactions
        COALESCE(SUM(t.creator_share_cents), 0)::NUMERIC AS creator_payouts,
        -- Platform Fees: A placeholder calculation for payment processor fees (e.g., Stripe's 2.9% + 30¢)
        (COALESCE(SUM(t.amount_cents * 0.029 + 30), 0))::NUMERIC AS platform_fees,
        -- Total Transactions: A simple count of all transactions in the period
        COUNT(t.*)::BIGINT AS total_transactions
    FROM all_transactions t;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."get_monthly_transactions"("p_month" integer, "p_year" integer) RETURNS TABLE("transaction_id" "uuid", "transaction_type" "text", "user_name" "text", "creator_name" "text", "amount_cents" integer, "platform_share_cents" integer, "creator_share_cents" integer, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    start_date TIMESTAMPTZ;
    end_date TIMESTAMPTZ;
BEGIN
    start_date := make_timestamptz(p_year, p_month, 1, 0, 0, 0);
    end_date := start_date + interval '1 month';

    RETURN QUERY
    SELECT 
        t.id AS transaction_id,
        'Tip' AS transaction_type,
        u.username AS user_name,
        c.username AS creator_name,
        t.amount_cents,
        t.platform_share_cents,
        t.creator_share_cents,
        t.created_at
    FROM tip_transactions t
    JOIN profiles u ON t.user_id = u.id
    LEFT JOIN profiles c ON t.creator_id = c.id
    WHERE t.created_at >= start_date AND t.created_at < end_date

    UNION ALL

    SELECT 
        ppv.id AS transaction_id,
        'PPV' AS transaction_type,
        u.username AS user_name,
        c.username AS creator_name,
        ppv.amount_cents,
        ppv.platform_share_cents,
        ppv.creator_share_cents,
        ppv.created_at
    FROM ppv_transactions ppv
    JOIN profiles u ON ppv.user_id = u.id
    LEFT JOIN posts p ON ppv.post_id = p.id
    -- FIX: Changed p.profile_id to p.user_id, assuming posts table uses user_id to link to profiles
    LEFT JOIN profiles c ON p.user_id = c.id
    WHERE ppv.created_at >= start_date AND ppv.created_at < end_date

    UNION ALL

    SELECT 
        sp.id AS transaction_id,
        'Subscription' AS transaction_type,
        u.username AS user_name,
        c.username AS creator_name,
        sp.amount_cents,
        sp.platform_share_cents,
        sp.creator_share_cents,
        sp.created_at
    FROM subscription_payments sp
    JOIN profiles u ON sp.user_id = u.id
    LEFT JOIN profiles c ON sp.creator_profile_id = c.id
    WHERE sp.created_at >= start_date AND sp.created_at < end_date

    UNION ALL

    SELECT 
        cpt.id AS transaction_id,
        'Product' AS transaction_type,
        u.username AS user_name,
        cr.username AS creator_name,
        cpt.amount_cents,
        cpt.platform_share_cents,
        cpt.creator_share_cents,
        cpt.created_at
    FROM creator_product_transactions cpt
    JOIN profiles u ON cpt.user_id = u.id
    LEFT JOIN creator_products cp ON cpt.creator_product_id = cp.id
    LEFT JOIN profiles cr ON cp.creator_profile_id = cr.id
    WHERE cpt.created_at >= start_date AND cpt.created_at < end_date

    UNION ALL

    SELECT 
        ct.id AS transaction_id,
        'Credit Purchase' AS transaction_type,
        u.username AS user_name,
        'N/A' AS creator_name,
        ct.amount_cents,
        ct.amount_cents AS platform_share_cents,
        0 AS creator_share_cents,
        ct.created_at
    FROM credit_transactions ct
    JOIN profiles u ON ct.user_id = u.id
    WHERE ct.created_at >= start_date AND ct.created_at < end_date;

END;
$$;

CREATE OR REPLACE FUNCTION "public"."get_shorts_posts_with_interactions"("p_current_user_id" "text", "p_limit" integer, "p_offset" integer, "p_filter_by_user_id" "text" DEFAULT NULL::"text", "p_filter_bookmarked_by_user_id" "text" DEFAULT NULL::"text", "p_search_query" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "user_id" "uuid", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "content_type" "text", "text_content" "text", "tags" "text"[], "category" character varying, "view_count" integer, "like_count" integer, "comment_count" integer, "share_count" integer, "bookmark_count" integer, "access_level" "text", "ppv_price_cents" integer, "metadata" "jsonb", "profiles" "jsonb", "post_media" "jsonb", "poll_results" "jsonb", "user_poll_vote" "uuid", "user_quiz_attempt" "jsonb", "user_has_liked" boolean, "user_has_bookmarked" boolean)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_current_user_uuid UUID;
    v_filter_by_user_uuid UUID;
    v_filter_bookmarked_by_user_uuid UUID;
    v_like_weight INTEGER;
    v_comment_weight INTEGER;
    v_bookmark_weight INTEGER;
    v_subs_weight DECIMAL(3,2);
BEGIN
    -- Get algorithm weights from platform_settings
    SELECT 
        algo_like_weight,
        algo_comment_weight,
        algo_bookmark_weight,
        algo_subs_weight
    INTO 
        v_like_weight,
        v_comment_weight,
        v_bookmark_weight,
        v_subs_weight
    FROM platform_settings 
    LIMIT 1;

    -- Set defaults if no settings found
    v_like_weight := COALESCE(v_like_weight, 1);
    v_comment_weight := COALESCE(v_comment_weight, 2);
    v_bookmark_weight := COALESCE(v_bookmark_weight, 3);
    v_subs_weight := COALESCE(v_subs_weight, 1.20);

    IF p_current_user_id IS NOT NULL THEN
        BEGIN
            v_current_user_uuid := p_current_user_id::UUID;
        EXCEPTION WHEN invalid_text_representation THEN
            v_current_user_uuid := NULL;
        END;
    ELSE
        v_current_user_uuid := NULL;
    END IF;

    IF p_filter_by_user_id IS NOT NULL THEN
        BEGIN
            v_filter_by_user_uuid := p_filter_by_user_id::UUID;
        EXCEPTION WHEN invalid_text_representation THEN
            v_filter_by_user_uuid := NULL;
        END;
    ELSE
        v_filter_by_user_uuid := NULL;
    END IF;

    IF p_filter_bookmarked_by_user_id IS NOT NULL THEN
        BEGIN
            v_filter_bookmarked_by_user_uuid := p_filter_bookmarked_by_user_id::UUID;
        EXCEPTION WHEN invalid_text_representation THEN
            v_filter_bookmarked_by_user_uuid := NULL;
        END;
    ELSE
        v_filter_bookmarked_by_user_uuid := NULL;
    END IF;

    RETURN QUERY
    SELECT
        p.id,
        p.user_id,
        p.created_at,
        p.updated_at,
        p.content_type::TEXT,
        p.text_content,
        p.tags,
        p.category::VARCHAR(255),
        p.view_count,
        p.like_count,
        p.comment_count,
        p.share_count,
        p.bookmark_count,
        p.access_level::TEXT,
        p.ppv_price_cents,
        p.metadata,
        to_jsonb(prof) AS profiles,
        (
            SELECT COALESCE(jsonb_agg(pm_select.* ORDER BY pm_select.order_index ASC), '[]'::jsonb)
            FROM post_media pm_select
            WHERE pm_select.post_id = p.id
        ) AS post_media,
        (
            SELECT COALESCE(jsonb_agg(json_build_object('option_id', T.selected_option_id, 'vote_count', T.vote_count)), '[]'::jsonb)
            FROM (
                SELECT selected_option_id, COUNT(poll_votes.id)::INTEGER as vote_count
                FROM poll_votes
                WHERE post_id = p.id
                GROUP BY selected_option_id
            ) AS T
        ) as poll_results,
        (
            SELECT pv_user_select.selected_option_id::UUID
            FROM poll_votes pv_user_select
            WHERE pv_user_select.post_id = p.id AND pv_user_select.user_id = v_current_user_uuid
            LIMIT 1
        ) AS user_poll_vote,
        (
            SELECT to_jsonb(qa_select.*)
            FROM quiz_attempts qa_select
            WHERE qa_select.post_id = p.id AND qa_select.user_id = v_current_user_uuid
            ORDER BY qa_select.attempted_at DESC
            LIMIT 1
        ) AS user_quiz_attempt,
        EXISTS (
            SELECT 1
            FROM user_post_interactions upi_like_select
            WHERE upi_like_select.post_id = p.id AND upi_like_select.user_id = v_current_user_uuid AND upi_like_select.interaction_type = 'post_like'
        ) AS user_has_liked,
        EXISTS (
            SELECT 1
            FROM user_post_interactions upi_bm_select
            WHERE upi_bm_select.post_id = p.id AND upi_bm_select.user_id = v_current_user_uuid AND upi_bm_select.interaction_type = 'post_save'
        ) AS user_has_bookmarked
    FROM
        posts p
    JOIN
        profiles prof ON p.user_id = prof.id
    LEFT JOIN
        user_post_interactions upi_bookmark_filter
        ON v_filter_bookmarked_by_user_uuid IS NOT NULL AND p.id = upi_bookmark_filter.post_id
           AND upi_bookmark_filter.user_id = v_filter_bookmarked_by_user_uuid
           AND upi_bookmark_filter.interaction_type = 'post_save'
    WHERE
        (v_filter_by_user_uuid IS NULL OR p.user_id = v_filter_by_user_uuid)
    AND
        (v_filter_bookmarked_by_user_uuid IS NULL OR upi_bookmark_filter.id IS NOT NULL)
    AND
        p.content_type::TEXT = 'short'
    AND
        (p_search_query IS NULL OR p.text_content ILIKE '%' || p_search_query || '%')
    ORDER BY 
        (p.like_count * v_like_weight + p.comment_count * v_comment_weight + p.bookmark_count * v_bookmark_weight) * 
        CASE WHEN EXISTS(
            SELECT 1 FROM subscriptions 
            WHERE follower_id = v_current_user_uuid 
            AND following_id = p.user_id 
            AND status = 'active'
        ) THEN v_subs_weight ELSE 1.0 END 
    DESC, p.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."get_suggested_profiles"("p_current_user_id" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 10, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "full_name" "text", "username" "text", "bio" "text", "avatar_url" "text", "banner_url" "text", "engagement_score" numeric, "post_count" integer, "total_likes" integer, "total_comments" integer, "total_bookmarks" integer)
    LANGUAGE "plpgsql"
    AS $$DECLARE
    v_current_user_uuid UUID;
    v_timeframe_minutes INTEGER;
    v_timeframe_start TIMESTAMPTZ;
    v_engagement_count INTEGER;
BEGIN
    -- Convert current user ID to UUID (handle null gracefully)
    IF p_current_user_id IS NOT NULL AND p_current_user_id != '' THEN
        BEGIN
            v_current_user_uuid := p_current_user_id::UUID;
        EXCEPTION WHEN invalid_text_representation THEN
            v_current_user_uuid := NULL;
        END;
    ELSE
        v_current_user_uuid := NULL;
    END IF;

    -- Get the suggestion timeframe from platform settings
    SELECT COALESCE(value::INTEGER, 1440) INTO v_timeframe_minutes
    FROM platform_settings 
    WHERE key = 'suggestion_timeframe';

    -- Calculate the start time based on the timeframe
    v_timeframe_start := NOW() - INTERVAL '1 minute' * v_timeframe_minutes;

    -- First, get profiles with engagement in the timeframe
    RETURN QUERY
    WITH engagement_profiles AS (
        SELECT
            prof.id,
            prof.full_name,
            prof.username,
            prof.bio,
            prof.avatar_url,
            prof.banner_url,
            prof.updated_at,
            COALESCE(engagement_stats.engagement_score, 0)::NUMERIC AS engagement_score,
            COALESCE(engagement_stats.post_count, 0)::INTEGER AS post_count,
            COALESCE(engagement_stats.total_likes, 0)::INTEGER AS total_likes,
            COALESCE(engagement_stats.total_comments, 0)::INTEGER AS total_comments,
            COALESCE(engagement_stats.total_bookmarks, 0)::INTEGER AS total_bookmarks
        FROM
            profiles prof
        LEFT JOIN (
            SELECT
                p.user_id,
                COUNT(DISTINCT p.id) AS post_count,
                -- Count likes that happened in the timeframe
                COUNT(DISTINCT CASE WHEN upi_likes.created_at >= v_timeframe_start THEN upi_likes.id END) AS total_likes,
                -- Count comments that happened in the timeframe
                COUNT(DISTINCT CASE WHEN c.created_at >= v_timeframe_start THEN c.id END) AS total_comments,
                -- Count bookmarks that happened in the timeframe
                COUNT(DISTINCT CASE WHEN upi_bookmarks.created_at >= v_timeframe_start THEN upi_bookmarks.id END) AS total_bookmarks,
                -- Calculate engagement score based on interactions in the timeframe
                (
                    COUNT(DISTINCT CASE WHEN upi_likes.created_at >= v_timeframe_start THEN upi_likes.id END) +
                    COUNT(DISTINCT CASE WHEN c.created_at >= v_timeframe_start THEN c.id END) * 2 +
                    COUNT(DISTINCT CASE WHEN upi_bookmarks.created_at >= v_timeframe_start THEN upi_bookmarks.id END) * 3
                ) AS engagement_score
            FROM
                posts p
            LEFT JOIN user_post_interactions upi_likes ON p.id = upi_likes.post_id 
                AND upi_likes.interaction_type = 'post_like'
            LEFT JOIN comments c ON p.id = c.post_id
            LEFT JOIN user_post_interactions upi_bookmarks ON p.id = upi_bookmarks.post_id 
                AND upi_bookmarks.interaction_type = 'post_save'
            WHERE
                p.access_level = 'public'::post_access_level
            GROUP BY
                p.user_id
        ) engagement_stats ON prof.id = engagement_stats.user_id
        WHERE
            -- Exclude the current user from suggestions (only if user is logged in)
            (v_current_user_uuid IS NULL OR prof.id != v_current_user_uuid)
            -- Only include profiles that have some engagement in the timeframe
            AND engagement_stats.engagement_score > 0
            -- Exclude profiles without username (incomplete profiles)
            AND prof.username IS NOT NULL
            AND prof.username != ''
            -- Exclude profiles that the current user is already subscribed to (only if user is logged in)
            AND (v_current_user_uuid IS NULL OR NOT EXISTS (
                SELECT 1 FROM subscriptions 
                WHERE follower_id = v_current_user_uuid 
                AND following_id = prof.id 
                AND status = 'active'
            ))
    ),
    fallback_profiles AS (
        SELECT
            prof.id,
            prof.full_name,
            prof.username,
            prof.bio,
            prof.avatar_url,
            prof.banner_url,
            prof.updated_at,
            0::NUMERIC AS engagement_score,
            0::INTEGER AS post_count,
            0::INTEGER AS total_likes,
            0::INTEGER AS total_comments,
            0::INTEGER AS total_bookmarks
        FROM
            profiles prof
        WHERE
            -- Exclude the current user from suggestions (only if user is logged in)
            (v_current_user_uuid IS NULL OR prof.id != v_current_user_uuid)
            -- Exclude profiles without username (incomplete profiles)
            AND prof.username IS NOT NULL
            AND prof.username != ''
            -- Exclude profiles that the current user is already subscribed to (only if user is logged in)
            AND (v_current_user_uuid IS NULL OR NOT EXISTS (
                SELECT 1 FROM subscriptions 
                WHERE follower_id = v_current_user_uuid 
                AND following_id = prof.id 
                AND status = 'active'
            ))
            -- Exclude profiles that are already in the engagement list
            AND prof.id NOT IN (SELECT ep.id FROM engagement_profiles ep)
    )
    SELECT 
        combined_profiles.id,
        combined_profiles.full_name,
        combined_profiles.username,
        combined_profiles.bio,
        combined_profiles.avatar_url,
        combined_profiles.banner_url,
        combined_profiles.engagement_score,
        combined_profiles.post_count,
        combined_profiles.total_likes,
        combined_profiles.total_comments,
        combined_profiles.total_bookmarks
    FROM (
        -- First, get engagement-based profiles
        SELECT *, 1 as sort_order FROM engagement_profiles
        UNION ALL
        -- Then, get fallback profiles to fill up to the limit
        SELECT *, 2 as sort_order FROM fallback_profiles
    ) combined_profiles
    ORDER BY 
        combined_profiles.sort_order ASC,
        combined_profiles.engagement_score DESC,
        combined_profiles.updated_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;$$;

CREATE OR REPLACE FUNCTION "public"."get_suggested_story_profiles"("p_current_user_id" "text", "p_limit" integer, "p_offset" integer) RETURNS TABLE("id" "uuid", "full_name" "text", "username" "text", "bio" "text", "avatar_url" "text", "banner_url" "text", "engagement_score" numeric, "post_count" integer, "total_likes" integer, "total_comments" integer, "total_bookmarks" integer)
    LANGUAGE "plpgsql"
    AS $$DECLARE
    v_current_user_uuid UUID;
    v_timeframe_minutes INTEGER;
    v_timeframe_start TIMESTAMPTZ;
    v_engagement_count INTEGER;
BEGIN
    -- Convert current user ID to UUID (handle null gracefully)
    IF p_current_user_id IS NOT NULL AND p_current_user_id != '' THEN
        BEGIN
            v_current_user_uuid := p_current_user_id::UUID;
        EXCEPTION WHEN invalid_text_representation THEN
            v_current_user_uuid := NULL;
        END;
    ELSE
        v_current_user_uuid := NULL;
    END IF;

    -- Get the suggestion timeframe from platform settings
    SELECT COALESCE(value::INTEGER, 1440) INTO v_timeframe_minutes
    FROM platform_settings 
    WHERE key = 'suggestion_timeframe';

    -- Calculate the start time based on the timeframe
    v_timeframe_start := NOW() - INTERVAL '1 minute' * v_timeframe_minutes;

    -- First, get profiles with engagement in the timeframe
    RETURN QUERY
    WITH engagement_profiles AS (
        SELECT
            prof.id,
            prof.full_name,
            prof.username,
            prof.bio,
            prof.avatar_url,
            prof.banner_url,
            prof.updated_at,
            COALESCE(engagement_stats.engagement_score, 0)::NUMERIC AS engagement_score,
            COALESCE(engagement_stats.post_count, 0)::INTEGER AS post_count,
            COALESCE(engagement_stats.total_likes, 0)::INTEGER AS total_likes,
            COALESCE(engagement_stats.total_comments, 0)::INTEGER AS total_comments,
            COALESCE(engagement_stats.total_bookmarks, 0)::INTEGER AS total_bookmarks,
            -- Check if current user is already subscribed to this profile
            CASE 
                WHEN v_current_user_uuid IS NOT NULL AND EXISTS (
                    SELECT 1 FROM subscriptions 
                    WHERE follower_id = v_current_user_uuid 
                    AND following_id = prof.id 
                    AND status = 'active'
                ) THEN true
                ELSE false
            END AS is_subscribed
        FROM
            profiles prof
        LEFT JOIN (
            SELECT
                p.user_id,
                COUNT(DISTINCT p.id) AS post_count,
                -- Count likes that happened in the timeframe
                COUNT(DISTINCT CASE WHEN upi_likes.created_at >= v_timeframe_start THEN upi_likes.id END) AS total_likes,
                -- Count comments that happened in the timeframe
                COUNT(DISTINCT CASE WHEN c.created_at >= v_timeframe_start THEN c.id END) AS total_comments,
                -- Count bookmarks that happened in the timeframe
                COUNT(DISTINCT CASE WHEN upi_bookmarks.created_at >= v_timeframe_start THEN upi_bookmarks.id END) AS total_bookmarks,
                -- Calculate engagement score based on interactions in the timeframe
                (
                    COUNT(DISTINCT CASE WHEN upi_likes.created_at >= v_timeframe_start THEN upi_likes.id END) +
                    COUNT(DISTINCT CASE WHEN c.created_at >= v_timeframe_start THEN c.id END) * 2 +
                    COUNT(DISTINCT CASE WHEN upi_bookmarks.created_at >= v_timeframe_start THEN upi_bookmarks.id END) * 3
                ) AS engagement_score
            FROM
                posts p
            LEFT JOIN user_post_interactions upi_likes ON p.id = upi_likes.post_id 
                AND upi_likes.interaction_type = 'post_like'
            LEFT JOIN comments c ON p.id = c.post_id
            LEFT JOIN user_post_interactions upi_bookmarks ON p.id = upi_bookmarks.post_id 
                AND upi_bookmarks.interaction_type = 'post_save'
            WHERE
                p.access_level = 'public'::post_access_level
            GROUP BY
                p.user_id
        ) engagement_stats ON prof.id = engagement_stats.user_id
        WHERE
            -- Exclude the current user from suggestions (only if user is logged in)
            (v_current_user_uuid IS NULL OR prof.id != v_current_user_uuid)
            -- Only include profiles that have some engagement in the timeframe
            AND engagement_stats.engagement_score > 0
            -- Exclude profiles without username (incomplete profiles)
            AND prof.username IS NOT NULL
            AND prof.username != ''
    ),
    fallback_profiles AS (
        SELECT
            prof.id,
            prof.full_name,
            prof.username,
            prof.bio,
            prof.avatar_url,
            prof.banner_url,
            prof.updated_at,
            0::NUMERIC AS engagement_score,
            0::INTEGER AS post_count,
            0::INTEGER AS total_likes,
            0::INTEGER AS total_comments,
            0::INTEGER AS total_bookmarks,
            -- Check if current user is already subscribed to this profile
            CASE 
                WHEN v_current_user_uuid IS NOT NULL AND EXISTS (
                    SELECT 1 FROM subscriptions 
                    WHERE follower_id = v_current_user_uuid 
                    AND following_id = prof.id 
                    AND status = 'active'
                ) THEN true
                ELSE false
            END AS is_subscribed
        FROM
            profiles prof
        WHERE
            -- Exclude the current user from suggestions (only if user is logged in)
            (v_current_user_uuid IS NULL OR prof.id != v_current_user_uuid)
            -- Exclude profiles without username (incomplete profiles)
            AND prof.username IS NOT NULL
            AND prof.username != ''
            -- Exclude profiles that are already in the engagement list
            AND prof.id NOT IN (SELECT ep.id FROM engagement_profiles ep)
    )
    SELECT 
        combined_profiles.id,
        combined_profiles.full_name,
        combined_profiles.username,
        combined_profiles.bio,
        combined_profiles.avatar_url,
        combined_profiles.banner_url,
        combined_profiles.engagement_score,
        combined_profiles.post_count,
        combined_profiles.total_likes,
        combined_profiles.total_comments,
        combined_profiles.total_bookmarks
    FROM (
        -- First, get engagement-based profiles
        SELECT *, 1 as sort_order FROM engagement_profiles
        UNION ALL
        -- Then, get fallback profiles to fill up to the limit
        SELECT *, 2 as sort_order FROM fallback_profiles
    ) combined_profiles
    ORDER BY 
        -- 1. Prioritize subscribed profiles first
        combined_profiles.is_subscribed DESC,
        -- 2. Then prioritize profiles with usernames less than 15 characters
        CASE WHEN LENGTH(combined_profiles.username) < 15 THEN 0 ELSE 1 END ASC,
        -- 3. Then by original sort order (engagement vs fallback)
        combined_profiles.sort_order ASC,
        -- 4. Then by engagement score
        combined_profiles.engagement_score DESC,
        -- 5. Finally by update time
        combined_profiles.updated_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;$$;

CREATE OR REPLACE FUNCTION "public"."get_unread_notification_count"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  count INTEGER;
BEGIN
  SELECT COUNT(*) INTO count
  FROM notifications
  WHERE user_id = p_user_id AND is_read = false;
  
  RETURN count;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."handle_new_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    new_username text;
    username_exists boolean;
    attempts integer := 0;
    max_attempts integer := 10;
BEGIN
    -- Only set username if it's not already provided
    IF NEW.username IS NULL THEN
        -- Generate a unique username
        LOOP
            new_username := generate_random_username(16);
            
            -- Check if username already exists
            SELECT EXISTS(SELECT 1 FROM profiles WHERE username = new_username) INTO username_exists;
            
            -- If username is unique, use it
            IF NOT username_exists THEN
                NEW.username := new_username;
                EXIT;
            END IF;
            
            -- Prevent infinite loop
            attempts := attempts + 1;
            IF attempts >= max_attempts THEN
                RAISE EXCEPTION 'Could not generate unique username after % attempts', max_attempts;
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

CREATE OR REPLACE FUNCTION "public"."increment_bookmark_count"("p_post_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
    DECLARE
      new_bookmark_count INTEGER;
    BEGIN
      UPDATE posts
      SET bookmark_count = bookmark_count + 1
      WHERE id = p_post_id
      RETURNING bookmark_count INTO new_bookmark_count;
      RETURN new_bookmark_count;
    END;
    $$;

CREATE OR REPLACE FUNCTION "public"."increment_comment_like_count"("p_comment_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
    DECLARE
      new_like_count INTEGER;
    BEGIN
      UPDATE public.comments
      SET like_count = like_count + 1
      WHERE id = p_comment_id
      RETURNING like_count INTO new_like_count;
      RETURN new_like_count;
    END;
    $$;

CREATE OR REPLACE FUNCTION "public"."increment_like_count"("p_post_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
    DECLARE
      new_like_count INTEGER;
    BEGIN
      UPDATE posts
      SET like_count = like_count + 1
      WHERE id = p_post_id
      RETURNING like_count INTO new_like_count;
      RETURN new_like_count;
    END;
    $$;

CREATE OR REPLACE FUNCTION "public"."increment_reply_count"("p_parent_comment_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  new_reply_count INTEGER;
BEGIN
  UPDATE public.comments
  SET reply_count = reply_count + 1
  WHERE id = p_parent_comment_id
  RETURNING reply_count INTO new_reply_count;
  RETURN new_reply_count;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."mark_notifications_read"("p_user_id" "uuid", "p_notification_ids" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  IF p_notification_ids IS NULL THEN
    -- Mark all user's notifications as read
    UPDATE notifications 
    SET is_read = true 
    WHERE user_id = p_user_id AND is_read = false;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
  ELSE
    -- Mark specific notifications as read
    UPDATE notifications 
    SET is_read = true 
    WHERE user_id = p_user_id 
      AND id = ANY(p_notification_ids) 
      AND is_read = false;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
  END IF;
  
  RETURN updated_count;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."trigger_set_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."update_bug_reports_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."update_comment_counts"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
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

CREATE OR REPLACE FUNCTION "public"."update_has_unread_msg_for_conversation"("conversation_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  participant RECORD;
  unread_count INTEGER;
BEGIN
  FOR participant IN
    SELECT user_id
    FROM conversation_participants
    WHERE conversation_participants.conversation_id = update_has_unread_msg_for_conversation.conversation_id
  LOOP
    -- Count unread conversations for this user
    SELECT COUNT(*)
    INTO unread_count
    FROM conversation_participants cp
    JOIN conversations c ON cp.conversation_id = c.id
    WHERE cp.user_id = participant.user_id
      AND c.last_message_id IS NOT NULL
      AND (
        cp.last_read_message_id IS DISTINCT FROM c.last_message_id
        AND (
          -- Only count as unread if the last message was not sent by the user
          (SELECT sender_id FROM messages WHERE id = c.last_message_id) IS DISTINCT FROM participant.user_id
        )
      );

    -- Update the profile
    UPDATE profiles
    SET "hasUnreadMsg" = (unread_count > 0)
    WHERE id = participant.user_id;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."update_like_counts"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
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

CREATE TABLE IF NOT EXISTS "public"."blocked_users" (
    "blocker_profile_id" "uuid" NOT NULL,
    "blockee_profile_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."blocked_users" OWNER TO "postgres";



CREATE TABLE IF NOT EXISTS "public"."call_transcripts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "creator_profile_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "is_user" boolean NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."call_transcripts" OWNER TO "postgres";



CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "parent_comment_id" "uuid",
    "text_content" "text" NOT NULL,
    "like_count" integer DEFAULT 0 NOT NULL,
    "reply_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."comments" OWNER TO "postgres";



CREATE TABLE IF NOT EXISTS "public"."conversation_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid",
    "user_id" "uuid",
    "joined_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "last_read_message_id" "uuid",
    "is_typing" boolean DEFAULT false
);


ALTER TABLE "public"."conversation_participants" OWNER TO "postgres";



CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "is_group" boolean DEFAULT false,
    "name" "text",
    "last_message_id" "uuid",
    "last_message_at" timestamp with time zone
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";



CREATE TABLE IF NOT EXISTS "public"."creators" (
    "profile_id" "uuid" NOT NULL,
    "stripe_account_id" "text",
    "stripe_onboarding_status" "public"."creator_onboarding_status" DEFAULT 'not_started'::"public"."creator_onboarding_status" NOT NULL,
    "can_monetize" boolean DEFAULT false NOT NULL,
    "application_notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "subscription_tier_enabled" boolean DEFAULT true NOT NULL,
    "subscription_price_cents" integer DEFAULT 500,
    "subscription_interval" "public"."subscription_interval" DEFAULT 'month'::"public"."subscription_interval",
    "stripe_product_id" "text",
    "default_stripe_price_id" "text",
    "payment_provider" "text",
    "generic_account_id" "text",
    "generic_product_id" "text",
    "generic_price_id" "text",
    "ai_call_enabled" boolean DEFAULT false NOT NULL,
    "ai_dms_enabled" boolean DEFAULT false NOT NULL,
    "personality_prompt" "text",
    "voice_sample_path" "text",
    "cartesia_voice_id" "text",
    "ai_call_multi" integer DEFAULT 1,
    "eleven_voice_id" "text",
    CONSTRAINT "chk_creator_subscription_logic" CHECK (((("subscription_tier_enabled" = true) AND ("subscription_price_cents" IS NOT NULL) AND ("subscription_interval" IS NOT NULL)) OR (("subscription_tier_enabled" = false) AND ("subscription_price_cents" IS NULL) AND ("subscription_interval" IS NULL) AND ("stripe_product_id" IS NULL) AND ("default_stripe_price_id" IS NULL) AND ("generic_product_id" IS NULL) AND ("generic_price_id" IS NULL)))),
    CONSTRAINT "creators_subscription_price_cents_check" CHECK ((("subscription_price_cents" IS NULL) OR ("subscription_price_cents" >= 0)))
);


ALTER TABLE "public"."creators" OWNER TO "postgres";


COMMENT ON COLUMN "public"."creators"."can_monetize" IS 'Indicates if the creator has completed all necessary steps to create monetized content.';



COMMENT ON COLUMN "public"."creators"."subscription_price_cents" IS 'Price in cents. 0 for a free tier, >0 for paid. NULL if subscription_tier_enabled is false.';



COMMENT ON COLUMN "public"."creators"."payment_provider" IS 'The payment provider this creator is configured to use (e.g., ''stripe'', ''paypal'', etc.).';



COMMENT ON COLUMN "public"."creators"."generic_account_id" IS 'Account ID for a non-Stripe payment provider, if applicable to the selected ''payment_provider''.';



COMMENT ON COLUMN "public"."creators"."generic_product_id" IS 'Product ID for a non-Stripe payment provider, if applicable.';



COMMENT ON COLUMN "public"."creators"."generic_price_id" IS 'Price ID for a non-Stripe payment provider, if applicable.';




CREATE TABLE IF NOT EXISTS "public"."credit_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount_cents" integer NOT NULL,
    "credits_purchased" integer NOT NULL,
    "currency" character(3) DEFAULT 'usd'::"bpchar" NOT NULL,
    "payment_provider" "text",
    "payment_intent_id" "text",
    "status" "text" DEFAULT 'succeeded'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "provider_transaction_reference" "text",
    "provider_specific_details" "jsonb",
    CONSTRAINT "chk_credit_amount_positive" CHECK (("amount_cents" > 0)),
    CONSTRAINT "chk_credits_purchased_positive" CHECK (("credits_purchased" > 0))
);


ALTER TABLE "public"."credit_transactions" OWNER TO "postgres";



CREATE TABLE IF NOT EXISTS "public"."likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "post_id" "uuid",
    "comment_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "chk_like_target" CHECK (((("post_id" IS NOT NULL) AND ("comment_id" IS NULL)) OR (("post_id" IS NULL) AND ("comment_id" IS NOT NULL))))
);


ALTER TABLE "public"."likes" OWNER TO "postgres";



CREATE TABLE IF NOT EXISTS "public"."stories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "media_url" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "view_count" integer DEFAULT 0,
    "overlays" "jsonb" DEFAULT '[]'::"jsonb"
);


ALTER TABLE "public"."stories" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."live_stories" AS
 SELECT "stories"."id",
    "stories"."profile_id",
    "stories"."media_url",
    "stories"."created_at",
    "stories"."view_count",
    "stories"."overlays"
   FROM "public"."stories"
  WHERE ("stories"."created_at" > ("now"() - '24:00:00'::interval));


ALTER TABLE "public"."live_stories" OWNER TO "postgres";



CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid",
    "sender_id" "uuid",
    "content" "text",
    "media_url" "text",
    "media_type" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "is_read" boolean DEFAULT false,
    "media_description" "text",
    "isPPV" boolean DEFAULT false NOT NULL,
    "PPV_price" integer,
    "PPV_transaction_id" "uuid"
);


ALTER TABLE "public"."messages" OWNER TO "postgres";



CREATE TABLE IF NOT EXISTS "public"."platform_settings" (
    "key" "text" NOT NULL,
    "value" "text",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "algo_like_weight" integer DEFAULT 1,
    "algo_comment_weight" integer DEFAULT 2,
    "algo_bookmark_weight" integer DEFAULT 3,
    "algo_subs_weight" numeric(3,2) DEFAULT 1.20
);


ALTER TABLE "public"."platform_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."platform_settings" IS 'Stores global platform settings, like the active payment provider.';



COMMENT ON COLUMN "public"."platform_settings"."key" IS 'The setting key (e.g., ''active_payment_provider'').';



COMMENT ON COLUMN "public"."platform_settings"."value" IS 'The setting value (e.g., ''stripe'').';



COMMENT ON COLUMN "public"."platform_settings"."description" IS 'A description of the setting.';




CREATE TABLE IF NOT EXISTS "public"."poll_votes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "selected_option_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."poll_votes" OWNER TO "postgres";



CREATE TABLE IF NOT EXISTS "public"."post_media" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "media_type" "public"."media_item_type" NOT NULL,
    "storage_path" "text",
    "mux_asset_id" "text",
    "mux_playback_id" "text",
    "order_index" smallint DEFAULT 0 NOT NULL,
    "alt_text" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "metadata" "jsonb",
    "mux_upload_id" "text",
    "mux_stream_key" "text",
    "blurred_storage_path" "text",
    "width" integer,
    "height" integer,
    "mux_stream_id" "text"
);


ALTER TABLE "public"."post_media" OWNER TO "postgres";



CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "content_type" "public"."post_content_type" NOT NULL,
    "text_content" "text",
    "parent_post_id" "uuid",
    "tags" "text"[],
    "category" "text",
    "view_count" integer DEFAULT 0 NOT NULL,
    "like_count" integer DEFAULT 0 NOT NULL,
    "comment_count" integer DEFAULT 0 NOT NULL,
    "share_count" integer DEFAULT 0 NOT NULL,
    "access_level" "public"."post_access_level" DEFAULT 'public'::"public"."post_access_level" NOT NULL,
    "ppv_price_cents" integer,
    "metadata" "jsonb",
    "bookmark_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "chk_posts_ppv_price_consistency" CHECK (((("access_level" = 'ppv'::"public"."post_access_level") AND ("ppv_price_cents" IS NOT NULL) AND ("ppv_price_cents" > 0)) OR (("access_level" <> 'ppv'::"public"."post_access_level") AND ("ppv_price_cents" IS NULL))))
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."posts"."ppv_price_cents" IS 'Price in cents for PPV posts. Must be set if access_level is ppv and > 0, otherwise must be null.';



COMMENT ON COLUMN "public"."posts"."metadata" IS 'For poll options, quiz structure, carousel item order, live stream details (Mux IDs), etc.';




CREATE TABLE IF NOT EXISTS "public"."ppv_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "post_id" "uuid",
    "amount_cents" integer NOT NULL,
    "currency" character(3) DEFAULT 'usd'::"bpchar" NOT NULL,
    "payment_provider" "text",
    "payment_intent_id" "text",
    "status" "text" DEFAULT 'succeeded'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "provider_transaction_reference" "text",
    "provider_specific_details" "jsonb",
    "creator_share_cents" integer,
    "platform_share_cents" integer,
    "message_id" "uuid",
    CONSTRAINT "chk_ppv_shares_match_amount" CHECK ((("creator_share_cents" + "platform_share_cents") = "amount_cents"))
);


ALTER TABLE "public"."ppv_transactions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."ppv_transactions"."payment_provider" IS 'The payment provider used for this transaction (e.g., ''stripe'', ''paypal'').';



COMMENT ON COLUMN "public"."ppv_transactions"."payment_intent_id" IS 'Stripe-specific Payment Intent ID. Null if not Stripe or not applicable.';



COMMENT ON COLUMN "public"."ppv_transactions"."provider_transaction_reference" IS 'Generic transaction reference or ID from the payment provider.';



COMMENT ON COLUMN "public"."ppv_transactions"."provider_specific_details" IS 'JSONB blob for any other provider-specific transaction data.';




CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "full_name" "text",
    "username" "text",
    "credits" integer DEFAULT 50,
    "bio" "text",
    "website" "text",
    "location" "text",
    "avatar_url" "text",
    "banner_url" "text",
    "hasUnreadMsg" boolean DEFAULT false,
    "stripe_customer_id" "text",
    "isAdmin" boolean DEFAULT false,
    "isBanned" boolean DEFAULT false,
    "isAllAccess" boolean DEFAULT false,
    CONSTRAINT "username_length" CHECK (("char_length"("username") >= 3))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."profiles" IS 'Public user profiles, linked to auth.users.';




CREATE TABLE IF NOT EXISTS "public"."quiz_attempts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "selected_option_id" "text" NOT NULL,
    "is_correct" boolean NOT NULL,
    "attempted_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."quiz_attempts" OWNER TO "postgres";



CREATE TABLE IF NOT EXISTS "public"."subscription_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "subscription_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "creator_profile_id" "uuid" NOT NULL,
    "amount_cents" integer NOT NULL,
    "currency" character(3) DEFAULT 'usd'::"bpchar" NOT NULL,
    "payment_provider" "text" NOT NULL,
    "payment_intent_id" "text",
    "charge_id" "text",
    "status" "text" DEFAULT 'succeeded'::"text" NOT NULL,
    "period_starts_at" timestamp with time zone NOT NULL,
    "period_ends_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "metadata" "jsonb",
    "provider_payment_reference" "text",
    "provider_specific_details" "jsonb",
    "creator_share_cents" integer,
    "platform_share_cents" integer,
    CONSTRAINT "chk_subscription_shares_match_amount" CHECK ((("creator_share_cents" + "platform_share_cents") = "amount_cents"))
);


ALTER TABLE "public"."subscription_payments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."subscription_payments"."payment_intent_id" IS 'Stripe-specific Payment Intent ID. Null if not Stripe or not applicable.';



COMMENT ON COLUMN "public"."subscription_payments"."charge_id" IS 'Stripe-specific Charge ID. Null if not Stripe or not applicable.';



COMMENT ON COLUMN "public"."subscription_payments"."provider_payment_reference" IS 'Generic payment reference or ID from the payment provider for this specific payment.';



COMMENT ON COLUMN "public"."subscription_payments"."provider_specific_details" IS 'JSONB blob for any other provider-specific payment data.';




CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "follower_id" "uuid" NOT NULL,
    "following_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "status" "public"."subscription_status" DEFAULT 'active'::"public"."subscription_status" NOT NULL,
    "current_period_ends_at" timestamp with time zone,
    "provider_subscription_id" "text",
    "price_at_time_of_subscription_cents" integer,
    "interval_at_time_of_subscription" "public"."subscription_interval",
    "canceled_at" timestamp with time zone,
    "trial_ends_at" timestamp with time zone,
    "payment_provider" "text",
    CONSTRAINT "chk_no_self_follow" CHECK (("follower_id" <> "following_id"))
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."subscriptions"."status" IS 'Status of the subscription (active, canceled, past_due, etc.).';



COMMENT ON COLUMN "public"."subscriptions"."current_period_ends_at" IS 'For recurring subscriptions, when the current paid period ends.';



COMMENT ON COLUMN "public"."subscriptions"."provider_subscription_id" IS 'The subscription ID from the payment provider (e.g., Stripe sub_xxxx, PayPal I-xxxx). Null if not a paid subscription or not yet set.';



COMMENT ON COLUMN "public"."subscriptions"."payment_provider" IS 'Indicates which payment provider manages this subscription (e.g., ''stripe'', ''paypal''). Relevant if provider_subscription_id is set.';




CREATE TABLE IF NOT EXISTS "public"."tip_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "post_id" "uuid",
    "amount_cents" integer NOT NULL,
    "currency" character(3) DEFAULT 'usd'::"bpchar" NOT NULL,
    "payment_provider" "text",
    "payment_intent_id" "text",
    "status" "text" DEFAULT 'succeeded'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "provider_transaction_reference" "text",
    "provider_specific_details" "jsonb",
    "creator_share_cents" integer,
    "platform_share_cents" integer,
    "creator_id" "uuid",
    CONSTRAINT "chk_tip_shares_match_amount" CHECK ((("creator_share_cents" + "platform_share_cents") = "amount_cents"))
);


ALTER TABLE "public"."tip_transactions" OWNER TO "postgres";



CREATE TABLE IF NOT EXISTS "public"."user_comment_interactions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "interaction_type" "public"."user_interaction_type" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_comment_interactions" OWNER TO "postgres";



CREATE TABLE IF NOT EXISTS "public"."user_post_interactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "interaction_type" "public"."user_interaction_type" NOT NULL,
    "interaction_metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."user_post_interactions" OWNER TO "postgres";



CREATE TABLE IF NOT EXISTS "public"."user_story_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "story_id" "uuid" NOT NULL,
    "viewer_profile_id" "uuid" NOT NULL,
    "viewed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_story_views" OWNER TO "postgres";



ALTER TABLE ONLY "public"."blocked_users"
    ADD CONSTRAINT "blocked_users_pkey" PRIMARY KEY ("blocker_profile_id", "blockee_profile_id");


ALTER TABLE ONLY "public"."call_transcripts"
    ADD CONSTRAINT "call_transcripts_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."creators"
    ADD CONSTRAINT "creators_default_stripe_price_id_key" UNIQUE ("default_stripe_price_id");


ALTER TABLE ONLY "public"."creators"
    ADD CONSTRAINT "creators_pkey" PRIMARY KEY ("profile_id");


ALTER TABLE ONLY "public"."creators"
    ADD CONSTRAINT "creators_stripe_account_id_key" UNIQUE ("stripe_account_id");


ALTER TABLE ONLY "public"."creators"
    ADD CONSTRAINT "creators_stripe_product_id_key" UNIQUE ("stripe_product_id");


ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_payment_intent_id_key" UNIQUE ("payment_intent_id");


ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key");


ALTER TABLE ONLY "public"."poll_votes"
    ADD CONSTRAINT "poll_votes_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."poll_votes"
    ADD CONSTRAINT "poll_votes_post_id_user_id_key" UNIQUE ("post_id", "user_id");


ALTER TABLE ONLY "public"."post_media"
    ADD CONSTRAINT "post_media_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."ppv_transactions"
    ADD CONSTRAINT "ppv_transactions_payment_intent_id_key" UNIQUE ("payment_intent_id");


ALTER TABLE ONLY "public"."ppv_transactions"
    ADD CONSTRAINT "ppv_transactions_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");


ALTER TABLE ONLY "public"."quiz_attempts"
    ADD CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."quiz_attempts"
    ADD CONSTRAINT "quiz_attempts_post_id_user_id_key" UNIQUE ("post_id", "user_id");


ALTER TABLE ONLY "public"."stories"
    ADD CONSTRAINT "stories_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."subscription_payments"
    ADD CONSTRAINT "subscription_payments_charge_id_key" UNIQUE ("charge_id");


ALTER TABLE ONLY "public"."subscription_payments"
    ADD CONSTRAINT "subscription_payments_payment_intent_id_key" UNIQUE ("payment_intent_id");


ALTER TABLE ONLY "public"."subscription_payments"
    ADD CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_payment_provider_subscription_id_key" UNIQUE ("provider_subscription_id");


ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey_new" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."tip_transactions"
    ADD CONSTRAINT "tip_transactions_payment_intent_id_key" UNIQUE ("payment_intent_id");


ALTER TABLE ONLY "public"."tip_transactions"
    ADD CONSTRAINT "tip_transactions_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "unique_follower_following" UNIQUE ("follower_id", "following_id");


ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "unique_participant" UNIQUE ("conversation_id", "user_id");


ALTER TABLE ONLY "public"."user_comment_interactions"
    ADD CONSTRAINT "user_comment_interaction_unique" UNIQUE ("user_id", "comment_id", "interaction_type");


ALTER TABLE ONLY "public"."user_comment_interactions"
    ADD CONSTRAINT "user_comment_interactions_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "user_liked_entity_unique" UNIQUE ("user_id", "post_id", "comment_id");


ALTER TABLE ONLY "public"."user_post_interactions"
    ADD CONSTRAINT "user_post_interactions_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."user_story_views"
    ADD CONSTRAINT "user_story_views_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."user_story_views"
    ADD CONSTRAINT "user_story_views_unique" UNIQUE ("story_id", "viewer_profile_id");


CREATE OR REPLACE TRIGGER "after_last_message_update" AFTER UPDATE OF "last_message_id" ON "public"."conversations" FOR EACH ROW WHEN (("old"."last_message_id" IS DISTINCT FROM "new"."last_message_id")) EXECUTE FUNCTION "public"."after_conversation_last_message_update_trigger"();

CREATE OR REPLACE TRIGGER "after_last_read_update" AFTER UPDATE OF "last_read_message_id" ON "public"."conversation_participants" FOR EACH ROW EXECUTE FUNCTION "public"."after_last_read_update_trigger"();

CREATE OR REPLACE TRIGGER "before_insert_or_update_posts_check_monetization" BEFORE INSERT OR UPDATE ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_post_monetization_rules"();

CREATE OR REPLACE TRIGGER "handle_updated_at_platform_settings" BEFORE UPDATE ON "public"."platform_settings" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();

CREATE OR REPLACE TRIGGER "on_comment_created_or_deleted" AFTER INSERT OR DELETE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_comment_counts"();

CREATE OR REPLACE TRIGGER "on_like_created_or_deleted" AFTER INSERT OR DELETE ON "public"."likes" FOR EACH ROW EXECUTE FUNCTION "public"."update_like_counts"();

CREATE OR REPLACE TRIGGER "on_profile_created" BEFORE INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_profile"();

ALTER TABLE ONLY "public"."blocked_users"
    ADD CONSTRAINT "blocked_users_blockee_profile_id_fkey" FOREIGN KEY ("blockee_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."blocked_users"
    ADD CONSTRAINT "blocked_users_blocker_profile_id_fkey" FOREIGN KEY ("blocker_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."call_transcripts"
    ADD CONSTRAINT "call_transcripts_creator_profile_id_fkey" FOREIGN KEY ("creator_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."call_transcripts"
    ADD CONSTRAINT "call_transcripts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_last_read_message_id_fkey" FOREIGN KEY ("last_read_message_id") REFERENCES "public"."messages"("id");


ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."creators"
    ADD CONSTRAINT "creators_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "fk_last_message" FOREIGN KEY ("last_message_id") REFERENCES "public"."messages"("id");


ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_ppv_transaction_id_fkey" FOREIGN KEY ("PPV_transaction_id") REFERENCES "public"."ppv_transactions"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."poll_votes"
    ADD CONSTRAINT "poll_votes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."poll_votes"
    ADD CONSTRAINT "poll_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."post_media"
    ADD CONSTRAINT "post_media_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."post_media"
    ADD CONSTRAINT "post_media_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_parent_post_id_fkey" FOREIGN KEY ("parent_post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."ppv_transactions"
    ADD CONSTRAINT "ppv_transactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."ppv_transactions"
    ADD CONSTRAINT "ppv_transactions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."ppv_transactions"
    ADD CONSTRAINT "ppv_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."quiz_attempts"
    ADD CONSTRAINT "quiz_attempts_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."quiz_attempts"
    ADD CONSTRAINT "quiz_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."stories"
    ADD CONSTRAINT "stories_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."subscription_payments"
    ADD CONSTRAINT "subscription_payments_creator_profile_id_fkey" FOREIGN KEY ("creator_profile_id") REFERENCES "public"."creators"("profile_id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."subscription_payments"
    ADD CONSTRAINT "subscription_payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."subscription_payments"
    ADD CONSTRAINT "subscription_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."tip_transactions"
    ADD CONSTRAINT "tip_transactions_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."profiles"("id");


ALTER TABLE ONLY "public"."tip_transactions"
    ADD CONSTRAINT "tip_transactions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."tip_transactions"
    ADD CONSTRAINT "tip_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."user_comment_interactions"
    ADD CONSTRAINT "user_comment_interactions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."user_comment_interactions"
    ADD CONSTRAINT "user_comment_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."user_post_interactions"
    ADD CONSTRAINT "user_post_interactions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."user_post_interactions"
    ADD CONSTRAINT "user_post_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."user_story_views"
    ADD CONSTRAINT "user_story_views_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."user_story_views"
    ADD CONSTRAINT "user_story_views_viewer_profile_id_fkey" FOREIGN KEY ("viewer_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_bookmark_count"("p_post_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_bookmark_count"("p_post_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_bookmark_count"("p_post_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_comment_like_count"("p_comment_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_comment_like_count"("p_comment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_comment_like_count"("p_comment_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_like_count"("p_post_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_like_count"("p_post_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_like_count"("p_post_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_reply_count"("p_parent_comment_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_reply_count"("p_parent_comment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_reply_count"("p_parent_comment_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_notifications_read"("p_user_id" "uuid", "p_notification_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."mark_notifications_read"("p_user_id" "uuid", "p_notification_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_notifications_read"("p_user_id" "uuid", "p_notification_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_set_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_set_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_set_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_bug_reports_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_bug_reports_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_bug_reports_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_comment_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_comment_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_comment_counts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_has_unread_msg_for_conversation"("conversation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_has_unread_msg_for_conversation"("conversation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_has_unread_msg_for_conversation"("conversation_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_like_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_like_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_like_counts"() TO "service_role";


















GRANT ALL ON TABLE "public"."blocked_users" TO "anon";
GRANT ALL ON TABLE "public"."blocked_users" TO "authenticated";
GRANT ALL ON TABLE "public"."blocked_users" TO "service_role";









GRANT ALL ON TABLE "public"."call_transcripts" TO "anon";
GRANT ALL ON TABLE "public"."call_transcripts" TO "authenticated";
GRANT ALL ON TABLE "public"."call_transcripts" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_participants" TO "anon";
GRANT ALL ON TABLE "public"."conversation_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_participants" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";












GRANT ALL ON TABLE "public"."creators" TO "anon";
GRANT ALL ON TABLE "public"."creators" TO "authenticated";
GRANT ALL ON TABLE "public"."creators" TO "service_role";



GRANT ALL ON TABLE "public"."credit_transactions" TO "anon";
GRANT ALL ON TABLE "public"."credit_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."likes" TO "anon";
GRANT ALL ON TABLE "public"."likes" TO "authenticated";
GRANT ALL ON TABLE "public"."likes" TO "service_role";



GRANT ALL ON TABLE "public"."stories" TO "anon";
GRANT ALL ON TABLE "public"."stories" TO "authenticated";
GRANT ALL ON TABLE "public"."stories" TO "service_role";



GRANT ALL ON TABLE "public"."live_stories" TO "anon";
GRANT ALL ON TABLE "public"."live_stories" TO "authenticated";
GRANT ALL ON TABLE "public"."live_stories" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";






GRANT ALL ON TABLE "public"."platform_settings" TO "anon";
GRANT ALL ON TABLE "public"."platform_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_settings" TO "service_role";



GRANT ALL ON TABLE "public"."poll_votes" TO "anon";
GRANT ALL ON TABLE "public"."poll_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."poll_votes" TO "service_role";



GRANT ALL ON TABLE "public"."post_media" TO "anon";
GRANT ALL ON TABLE "public"."post_media" TO "authenticated";
GRANT ALL ON TABLE "public"."post_media" TO "service_role";



GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";



GRANT ALL ON TABLE "public"."ppv_transactions" TO "anon";
GRANT ALL ON TABLE "public"."ppv_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."ppv_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";






GRANT ALL ON TABLE "public"."quiz_attempts" TO "anon";
GRANT ALL ON TABLE "public"."quiz_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."quiz_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_payments" TO "anon";
GRANT ALL ON TABLE "public"."subscription_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_payments" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."tip_transactions" TO "anon";
GRANT ALL ON TABLE "public"."tip_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."tip_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."user_comment_interactions" TO "anon";
GRANT ALL ON TABLE "public"."user_comment_interactions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_comment_interactions" TO "service_role";



GRANT ALL ON TABLE "public"."user_post_interactions" TO "anon";
GRANT ALL ON TABLE "public"."user_post_interactions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_post_interactions" TO "service_role";



GRANT ALL ON TABLE "public"."user_story_views" TO "anon";
GRANT ALL ON TABLE "public"."user_story_views" TO "authenticated";
GRANT ALL ON TABLE "public"."user_story_views" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;



-- Create profile row when a user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
