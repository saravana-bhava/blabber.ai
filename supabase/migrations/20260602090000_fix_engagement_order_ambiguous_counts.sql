-- Fix ambiguous return-column names in engagement ORDER BY clauses.
-- A later search_path hardening migration reintroduced unqualified count columns,
-- which collide with RETURNS TABLE output names in PL/pgSQL.

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
        (p.like_count + p.comment_count * 2 + p.bookmark_count * 3) *
        CASE WHEN EXISTS(
            SELECT 1 FROM public.subscriptions s
            WHERE s.follower_id = v_current_user_uuid
              AND s.following_id = p.user_id
              AND s.status = 'active'
        ) THEN 1.2 ELSE 1.0 END DESC,
        p.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

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
        (p.like_count + p.comment_count * 2 + p.bookmark_count * 3) *
        CASE WHEN EXISTS(
            SELECT 1 FROM public.subscriptions s
            WHERE s.follower_id = v_current_user_uuid
              AND s.following_id = p.user_id
              AND s.status = 'active'
        ) THEN 1.2 ELSE 1.0 END DESC,
        p.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;
