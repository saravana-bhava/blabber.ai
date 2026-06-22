-- Optional images shown in the AI call modal when fans call this creator (overrides profile avatar).

alter table public.creators
  add column if not exists ai_call_image_primary_path text null,
  add column if not exists ai_call_image_secondary_path text null;

comment on column public.creators.ai_call_image_primary_path is 'Storage path in creator-content bucket for primary call modal photo override.';
comment on column public.creators.ai_call_image_secondary_path is 'Storage path in creator-content bucket for secondary call modal photo override (random pick with primary when both set).';
