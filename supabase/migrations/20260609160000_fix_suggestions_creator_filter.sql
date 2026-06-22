-- Fix get_suggested_profiles() to only return verified creators (can_monetize = true).
-- Previously both the engagement and fallback CTEs had no creator filter,
-- causing regular fans and unverified users to appear in the suggestions rail.
CREATE OR REPLACE FUNCTION get_suggested_profiles(
    p_current_user_id TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 10,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    username TEXT,
    bio TEXT,
    avatar_url TEXT,
    banner_url TEXT,
    engagement_score NUMERIC,
    post_count INTEGER,
    total_likes INTEGER,
    total_comments INTEGER,
    total_bookmarks INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_user_uuid UUID;
    v_timeframe_minutes INTEGER;
    v_timeframe_start TIMESTAMPTZ;
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

    SELECT COALESCE(value::INTEGER, 1440) INTO v_timeframe_minutes
    FROM platform_settings
    WHERE key = 'suggestion_timeframe';

    v_timeframe_start := NOW() - INTERVAL '1 minute' * v_timeframe_minutes;

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
        INNER JOIN creators c ON c.profile_id = prof.id AND c.can_monetize = true
        LEFT JOIN (
            SELECT
                p.user_id,
                COUNT(DISTINCT p.id) AS post_count,
                COUNT(DISTINCT CASE WHEN upi_likes.created_at >= v_timeframe_start THEN upi_likes.id END) AS total_likes,
                COUNT(DISTINCT CASE WHEN comments.created_at >= v_timeframe_start THEN comments.id END) AS total_comments,
                COUNT(DISTINCT CASE WHEN upi_bookmarks.created_at >= v_timeframe_start THEN upi_bookmarks.id END) AS total_bookmarks,
                (
                    COUNT(DISTINCT CASE WHEN upi_likes.created_at >= v_timeframe_start THEN upi_likes.id END) +
                    COUNT(DISTINCT CASE WHEN comments.created_at >= v_timeframe_start THEN comments.id END) * 2 +
                    COUNT(DISTINCT CASE WHEN upi_bookmarks.created_at >= v_timeframe_start THEN upi_bookmarks.id END) * 3
                ) AS engagement_score
            FROM posts p
            LEFT JOIN user_post_interactions upi_likes ON p.id = upi_likes.post_id
                AND upi_likes.interaction_type = 'post_like'
            LEFT JOIN comments ON p.id = comments.post_id
            LEFT JOIN user_post_interactions upi_bookmarks ON p.id = upi_bookmarks.post_id
                AND upi_bookmarks.interaction_type = 'post_save'
            WHERE p.access_level = 'public'::post_access_level
            GROUP BY p.user_id
        ) engagement_stats ON prof.id = engagement_stats.user_id
        WHERE
            (v_current_user_uuid IS NULL OR prof.id != v_current_user_uuid)
            AND engagement_stats.engagement_score > 0
            AND prof.username IS NOT NULL
            AND prof.username != ''
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
        FROM profiles prof
        INNER JOIN creators c ON c.profile_id = prof.id AND c.can_monetize = true
        WHERE
            (v_current_user_uuid IS NULL OR prof.id != v_current_user_uuid)
            AND prof.username IS NOT NULL
            AND prof.username != ''
            AND (v_current_user_uuid IS NULL OR NOT EXISTS (
                SELECT 1 FROM subscriptions
                WHERE follower_id = v_current_user_uuid
                AND following_id = prof.id
                AND status = 'active'
            ))
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
        SELECT *, 1 as sort_order FROM engagement_profiles
        UNION ALL
        SELECT *, 2 as sort_order FROM fallback_profiles
    ) combined_profiles
    ORDER BY
        combined_profiles.sort_order ASC,
        combined_profiles.engagement_score DESC,
        combined_profiles.updated_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;
