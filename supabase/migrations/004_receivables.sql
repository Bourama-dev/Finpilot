-- Receivables (reste à percevoir)
create table if not exists receivables (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  activity activity_type not null default 'freelance',
  client text not null,
  invoice_ref text,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'EUR',
  status text not null default 'to_invoice'
    check (status in ('to_invoice', 'invoiced', 'paid')),
  service_date date,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table receivables enable row level security;

drop policy if exists "own_receivables" on receivables;
create policy "own_receivables" on receivables
  for all using (auth.uid() = user_id);

drop trigger if exists receivables_updated_at on receivables;
create trigger receivables_updated_at before update on receivables
  for each row execute function set_updated_at();
