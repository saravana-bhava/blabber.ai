-- Fix: previous definition used "sender_id in (user, creator)" which returned every
-- message those users ever sent (all of the creator's DMs leaked into every fan's AI context).
-- Scope to the single 1:1 conversation whose participants are exactly the pair.

CREATE OR REPLACE FUNCTION public.get_combined_communication_history(
  p_user_id uuid,
  p_target_profile_id uuid,
  p_limit integer
)
RETURNS TABLE (
  id uuid,
  content text,
  media_description text,
  created_at timestamptz,
  sender_id uuid,
  is_user boolean,
  type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  (
    SELECT
      m.id,
      m.content,
      m.media_description,
      m.created_at,
      m.sender_id,
      (m.sender_id = p_user_id) AS is_user,
      'message'::text AS type
    FROM messages m
    WHERE m.conversation_id = (
      SELECT cp.conversation_id
      FROM conversation_participants cp
      GROUP BY cp.conversation_id
      HAVING
        count(cp.user_id) = 2
        AND count(case WHEN cp.user_id IN (p_user_id, p_target_profile_id) THEN 1 END) = 2
      LIMIT 1
    )
  )
  UNION ALL
  (
    SELECT
      ct.id,
      ct.content,
      NULL::text AS media_description,
      ct.created_at,
      NULL::uuid AS sender_id,
      ct.is_user,
      'transcript'::text AS type
    FROM call_transcripts ct
    WHERE (ct.user_id = p_user_id AND ct.creator_profile_id = p_target_profile_id)
       OR (ct.user_id = p_target_profile_id AND ct.creator_profile_id = p_user_id)
  )
  ORDER BY created_at DESC
  LIMIT p_limit;
END;
$$;
