-- Combined DM messages + call transcripts for AI context (scoped to one 1:1 thread).
create or replace function public.get_combined_communication_history(
  p_user_id uuid,
  p_target_profile_id uuid,
  p_limit integer
)
returns table (
  id uuid,
  content text,
  media_description text,
  created_at timestamptz,
  sender_id uuid,
  is_user boolean,
  type text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  (
    select
      m.id,
      m.content,
      m.media_description,
      m.created_at,
      m.sender_id,
      (m.sender_id = p_user_id) as is_user,
      'message'::text as type
    from messages m
    where m.conversation_id = (
      select cp.conversation_id
      from conversation_participants cp
      group by cp.conversation_id
      having
        count(cp.user_id) = 2
        and count(case when cp.user_id in (p_user_id, p_target_profile_id) then 1 end) = 2
      limit 1
    )
  )
  union all
  (
    select
      ct.id,
      ct.content,
      null::text as media_description,
      ct.created_at,
      null::uuid as sender_id,
      ct.is_user,
      'transcript'::text as type
    from call_transcripts ct
    where (ct.user_id = p_user_id and ct.creator_profile_id = p_target_profile_id)
       or (ct.user_id = p_target_profile_id and ct.creator_profile_id = p_user_id)
  )
  order by created_at desc
  limit p_limit;
end;
$$;
