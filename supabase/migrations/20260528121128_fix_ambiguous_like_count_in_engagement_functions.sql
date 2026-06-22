-- =============================================================================
-- Fix: ambiguous column reference "like_count" in engagement-ordered functions
-- PostgreSQL could not resolve whether like_count/comment_count/bookmark_count
-- referred to the RETURNS TABLE output columns or the posts table columns.
-- Fix: qualify with p. in ORDER BY; also apply search_path = '' convention.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_shorts_posts_with_interactions(
    p_current_user_id TEXT,
    p_limit INTEGER,
    p_offset INTEGER,
    p_filter_by_user_id TEXT DEFAULT NULL,
    p_filter_bookmarked_by_user_id TEXT DEFAULT NULL,
    p_search_query TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    content_type TEXT,
    text_content TEXT,
    tags TEXT[],
    category VARCHAR(255),
    view_count INTEGER,
    like_count INTEGER,
    comment_count INTEGER,
    share_count INTEGER,
    bookmark_count INTEGER,
    access_level TEXT,
    ppv_price_cents INTEGER,
    metadata JSONB,
    profiles JSONB,
    post_media JSONB,
    poll_results JSONB,
    user_poll_vote UUID,
    user_quiz_attempt JSONB,
    user_has_liked BOOLEAN,
    user_has_bookmarked BOOLEAN
)
LANGUAGE plpgsql
SET search_path = ''
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
            FROM public.post_media pm_select
            WHERE pm_select.post_id = p.id
        ) AS post_media,
        (
            SELECT COALESCE(jsonb_agg(json_build_object('option_id', T.selected_option_id, 'vote_count', T.vote_count)), '[]'::jsonb)
            FROM (
                SELECT selected_option_id, COUNT(poll_votes.id)::INTEGER as vote_count
                FROM public.poll_votes
                WHERE post_id = p.id
                GROUP BY selected_option_id
            ) AS T
        ) as poll_results,
        (
            SELECT pv_user_select.selected_option_id::UUID
            FROM public.poll_votes pv_user_select
            WHERE pv_user_select.post_id = p.id AND pv_user_select.user_id = v_current_user_uuid
            LIMIT 1
        ) AS user_poll_vote,
        (
            SELECT to_jsonb(qa_select.*)
            FROM public.quiz_attempts qa_select
            WHERE qa_select.post_id = p.id AND qa_select.user_id = v_current_user_uuid
            ORDER BY qa_select.attempted_at DESC
            LIMIT 1
        ) AS user_quiz_attempt,
        EXISTS (
            SELECT 1
            FROM public.user_post_interactions upi_like_select
            WHERE upi_like_select.post_id = p.id AND upi_like_select.user_id = v_current_user_uuid AND upi_like_select.interaction_type = 'post_like'
        ) AS user_has_liked,
        EXISTS (
            SELECT 1
            FROM public.user_post_interactions upi_bm_select
            WHERE upi_bm_select.post_id = p.id AND upi_bm_select.user_id = v_current_user_uuid AND upi_bm_select.interaction_type = 'post_save'
        ) AS user_has_bookmarked
    FROM
        public.posts p
    JOIN
        public.profiles prof ON p.user_id = prof.id
    LEFT JOIN
        public.user_post_interactions upi_bookmark_filter
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
        (p.like_count + p.comment_count * 2 + p.bookmark_count * 3) *
        CASE WHEN EXISTS(
            SELECT 1 FROM public.subscriptions
            WHERE follower_id = v_current_user_uuid
            AND following_id = p.user_id
            AND status = 'active'
        ) THEN 1.2 ELSE 1.0 END
    DESC, p.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_explore_posts_with_interactions_engagement(
    p_current_user_id TEXT,
    p_limit INTEGER,
    p_offset INTEGER,
    p_filter_by_user_id TEXT DEFAULT NULL,
    p_filter_bookmarked_by_user_id TEXT DEFAULT NULL,
    p_search_query TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    content_type TEXT,
    text_content TEXT,
    tags TEXT[],
    category VARCHAR(255),
    view_count INTEGER,
    like_count INTEGER,
    comment_count INTEGER,
    share_count INTEGER,
    bookmark_count INTEGER,
    access_level TEXT,
    ppv_price_cents INTEGER,
    metadata JSONB,
    profiles JSONB,
    post_media JSONB,
    poll_results JSONB,
    user_poll_vote UUID,
    user_quiz_attempt JSONB,
    user_has_liked BOOLEAN,
    user_has_bookmarked BOOLEAN
)
LANGUAGE plpgsql
SET search_path = ''
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
            FROM public.post_media pm_select
            WHERE pm_select.post_id = p.id
        ) AS post_media,
        (
            SELECT COALESCE(jsonb_agg(json_build_object('option_id', T.selected_option_id, 'vote_count', T.vote_count)), '[]'::jsonb)
            FROM (
                SELECT selected_option_id, COUNT(poll_votes.id)::INTEGER as vote_count
                FROM public.poll_votes
                WHERE post_id = p.id
                GROUP BY selected_option_id
            ) AS T
        ) as poll_results,
        (
            SELECT pv_user_select.selected_option_id::UUID
            FROM public.poll_votes pv_user_select
            WHERE pv_user_select.post_id = p.id AND pv_user_select.user_id = v_current_user_uuid
            LIMIT 1
        ) AS user_poll_vote,
        (
            SELECT to_jsonb(qa_select.*)
            FROM public.quiz_attempts qa_select
            WHERE qa_select.post_id = p.id AND qa_select.user_id = v_current_user_uuid
            ORDER BY qa_select.attempted_at DESC
            LIMIT 1
        ) AS user_quiz_attempt,
        EXISTS (
            SELECT 1
            FROM public.user_post_interactions upi_like_select
            WHERE upi_like_select.post_id = p.id AND upi_like_select.user_id = v_current_user_uuid AND upi_like_select.interaction_type = 'post_like'
        ) AS user_has_liked,
        EXISTS (
            SELECT 1
            FROM public.user_post_interactions upi_bm_select
            WHERE upi_bm_select.post_id = p.id AND upi_bm_select.user_id = v_current_user_uuid AND upi_bm_select.interaction_type = 'post_save'
        ) AS user_has_bookmarked
    FROM
        public.posts p
    JOIN
        public.profiles prof ON p.user_id = prof.id
    LEFT JOIN
        public.user_post_interactions upi_bookmark_filter
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
             FROM public.post_media pm
             WHERE pm.post_id = p.id AND pm.media_type = 'short'
         ))
    AND
        (p_search_query IS NULL OR p.text_content ILIKE '%' || p_search_query || '%')
    ORDER BY
        (p.like_count + p.comment_count * 2 + p.bookmark_count * 3) *
        CASE WHEN EXISTS(
            SELECT 1 FROM public.subscriptions
            WHERE follower_id = v_current_user_uuid
            AND following_id = p.user_id
            AND status = 'active'
        ) THEN 1.2 ELSE 1.0 END
    DESC, p.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;
