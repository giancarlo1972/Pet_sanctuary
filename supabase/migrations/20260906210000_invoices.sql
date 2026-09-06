-- Rescue Army records invoice lines only. Payment stays with clinic / PayPal / Lemonade.
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience in ('owner', 'shelter', 'organization', 'sponsor')),
  vendor text not null,
  description text,
  amount_cents integer not null default 0,
  status text not null default 'recorded',
  pet_id uuid,
  organization_id uuid,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table public.invoices enable row level security;

drop policy if exists invoices_read on public.invoices;
create policy invoices_read on public.invoices for select to authenticated using (true);

drop policy if exists invoices_write on public.invoices;
create policy invoices_write on public.invoices for insert to authenticated with check (true);
