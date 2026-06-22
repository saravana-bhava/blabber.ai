-- Realtime postgres_changes only fire for tables in supabase_realtime.
-- Required for live DMs, typing indicators, and AI reply delivery.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'messages',
    'conversation_participants',
    'conversations'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables pt
      WHERE pt.pubname = 'supabase_realtime'
        AND pt.schemaname = 'public'
        AND pt.tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
