-- Audit table for identity verification data from Veriff.
-- Locked down: only service_role / admin can read or write.
-- One row per webhook event so we keep a full history of every verification attempt.

create table if not exists public.veriff_identity_records (
  id uuid not null default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  veriff_session_id text not null,
  attempt_id text null,
  event_type text not null default 'decision',

  -- Decision outcome
  decision text null,
  decision_code integer null,
  decision_score numeric(5,4) null,

  -- Person data extracted from document / selfie
  first_name text null,
  last_name text null,
  date_of_birth text null,
  year_of_birth text null,
  gender text null,
  nationality text null,
  citizenship text null,
  id_number text null,
  place_of_birth text null,
  estimated_age integer null,

  -- Document data
  document_type text null,
  document_number text null,
  document_country text null,
  document_valid_from text null,
  document_valid_until text null,
  document_state text null,

  -- Timestamps from Veriff
  acceptance_time timestamptz null,
  submission_time timestamptz null,
  decision_time timestamptz null,

  -- Full raw payload for future reference
  raw_payload jsonb not null,

  created_at timestamptz not null default now(),
  constraint veriff_identity_records_pkey primary key (id)
);

create index if not exists idx_veriff_identity_records_profile
  on public.veriff_identity_records (profile_id);
create index if not exists idx_veriff_identity_records_session
  on public.veriff_identity_records (veriff_session_id);

-- RLS: enable but grant NO access to anon / authenticated roles.
-- Only service_role (used by our API routes) can read/write.
alter table public.veriff_identity_records enable row level security;

-- Explicit deny-all: no policies = no access for anon/authenticated.
-- service_role bypasses RLS automatically.

comment on table public.veriff_identity_records
  is 'Immutable audit log of identity verification data received from Veriff webhooks. Locked to service_role only for regulatory compliance.';
