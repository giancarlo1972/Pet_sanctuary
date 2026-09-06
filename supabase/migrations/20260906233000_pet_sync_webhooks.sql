-- Pet sync + external ids so RescueGroups (and other) webhooks can upsert in real time.
-- Run in Supabase SQL editor if Cloudflare deploy does not apply migrations.

create table if not exists public.pet_sync (
  source text not null,
  external_id text not null,
  pet_id uuid,
  status text,
  event text,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (source, external_id)
);

alter table public.pets add column if not exists external_source text;
alter table public.pets add column if not exists external_id text;

create unique index if not exists pets_external_source_id_uidx
  on public.pets (external_source, external_id)
  where external_id is not null;

alter table public.pet_sync enable row level security;

drop policy if exists pet_sync_read_authenticated on public.pet_sync;
create policy pet_sync_read_authenticated
  on public.pet_sync for select
  to authenticated
  using (true);

-- Writes: service role only (webhook). No anon insert.
