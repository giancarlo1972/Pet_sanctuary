-- Pet is the source of truth. Owner of the pet always manages. Others only if shared.
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  audience text not null default 'owner',
  vendor text not null,
  description text,
  amount_cents integer not null default 0,
  status text not null default 'recorded',
  pet_id uuid,
  organization_id uuid,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table public.invoices add column if not exists shared_with text[] not null default array['owner']::text[];

alter table public.invoices enable row level security;
