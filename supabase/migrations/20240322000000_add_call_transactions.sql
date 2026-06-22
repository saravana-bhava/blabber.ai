create table public.call_transactions (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  creator_profile_id uuid not null,
  call_length_seconds integer not null,
  credits_used integer not null,
  credits_cents integer not null,
  creator_share_cents integer not null,
  platform_share_cents integer not null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint call_transactions_pkey primary key (id),
  constraint call_transactions_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade,
  constraint call_transactions_creator_profile_id_fkey foreign key (creator_profile_id) references profiles(id) on delete cascade,
  constraint chk_call_shares_match_amount check (creator_share_cents + platform_share_cents = credits_cents),
  constraint chk_call_amount_positive check (credits_cents > 0)
) tablespace pg_default;

create index if not exists idx_call_transactions_user_id on public.call_transactions using btree (user_id) tablespace pg_default;
create index if not exists idx_call_transactions_creator_profile_id on public.call_transactions using btree (creator_profile_id) tablespace pg_default;
create index if not exists idx_call_transactions_created_at on public.call_transactions using btree (created_at desc) tablespace pg_default; 