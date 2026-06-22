-- notifications.actor_id was referencing auth.users(id), which PostgREST cannot
-- auto-join through (auth schema is not exposed). Change it to public.profiles(id)
-- so the PostgREST query actor:actor_id(username, avatar_url) resolves correctly.
-- The UUIDs are identical between auth.users and public.profiles.

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_actor_id_fkey;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
