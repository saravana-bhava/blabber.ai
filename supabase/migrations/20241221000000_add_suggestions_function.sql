-- Add suggestion_timeframe platform setting (default 24 hours = 1440 minutes)
INSERT INTO platform_settings (key, value, description) VALUES
('suggestion_timeframe', '1440', 'Timeframe in minutes for suggestions sidebar (default 24 hours)')
ON CONFLICT (key) DO UPDATE SET 
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = timezone('utc'::text, now());

-- Create function to get profiles ordered by engagement in specified timeframe
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
    v_engagement_count INTEGER;
BEGIN
    -- Convert current user ID to UUID
    IF p_current_user_id IS NOT NULL THEN
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
            -- Exclude the current user from suggestions (only if user is signed in)
            (v_current_user_uuid IS NULL OR prof.id != v_current_user_uuid)
            -- Only include profiles that have some engagement in the timeframe
            AND engagement_stats.engagement_score > 0
            -- Exclude profiles without username (incomplete profiles)
            AND prof.username IS NOT NULL
            AND prof.username != ''
            -- Exclude profiles that the current user is already subscribed to (only if user is signed in)
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
            -- Exclude the current user from suggestions (only if user is signed in)
            (v_current_user_uuid IS NULL OR prof.id != v_current_user_uuid)
            -- Exclude profiles without username (incomplete profiles)
            AND prof.username IS NOT NULL
            AND prof.username != ''
            -- Exclude profiles that the current user is already subscribed to (only if user is signed in)
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
END;
$$; 