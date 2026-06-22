-- =============================================================================
-- Restrict direct client read access to mux_stream_key
--
-- The stream key is a Mux RTMP ingest secret. With the post_media_select
-- RLS policy using USING (true), any authenticated user could query
-- post_media.mux_stream_key for any row — allowing them to hijack a stream.
--
-- Fix: revoke column-level SELECT on mux_stream_key from the authenticated
-- role. Service role (used by server actions, webhooks, and cron jobs) is
-- unaffected and can still read the column.
--
-- The getBroadcastStreamData server action is updated in the same commit to
-- use createServiceRoleClient() for the media query (with explicit ownership
-- verification via user_id = auth user id).
-- =============================================================================

REVOKE SELECT (mux_stream_key) ON public.post_media FROM authenticated;
