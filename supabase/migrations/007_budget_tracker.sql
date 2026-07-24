-- Suivi budget & remboursement : lignes de revenus/charges mensuelles, crédits
-- renouvelables (Sofinco/Oney...) et journal des dépenses exceptionnelles.
-- Remplace la logique "budget par catégorie" par un suivi mensuel complet.

create table if not exists public.budget_lines (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  section text not null check (section in ('revenue', 'fixed_charge')),
  label text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.budget_lines enable row level security;
drop policy if exists "own_budget_lines" on public.budget_lines;
create policy "own_budget_lines" on public.budget_lines
  for all using (auth.uid() = user_id);

create table if not exists public.budget_line_values (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  line_id uuid not null references public.budget_lines(id) on delete cascade,
  month date not null,
  amount numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  unique (line_id, month)
);

alter table public.budget_line_values enable row level security;
drop policy if exists "own_budget_line_values" on public.budget_line_values;
create policy "own_budget_line_values" on public.budget_line_values
  for all using (auth.uid() = user_id);

create table if not exists public.budget_monthly_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  month date not null,
  safety_margin_target numeric(12, 2) not null default 350,
  created_at timestamptz not null default now(),
  unique (user_id, month)
);

alter table public.budget_monthly_settings enable row level security;
drop policy if exists "own_budget_monthly_settings" on public.budget_monthly_settings;
create policy "own_budget_monthly_settings" on public.budget_monthly_settings
  for all using (auth.uid() = user_id);

create table if not exists public.budget_credits (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  taeg numeric(5, 2),
  starting_balance numeric(12, 2) not null default 0,
  start_month date not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.budget_credits enable row level security;
drop policy if exists "own_budget_credits" on public.budget_credits;
create policy "own_budget_credits" on public.budget_credits
  for all using (auth.uid() = user_id);

create table if not exists public.budget_credit_repayments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  credit_id uuid not null references public.budget_credits(id) on delete cascade,
  month date not null,
  amount numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  unique (credit_id, month)
);

alter table public.budget_credit_repayments enable row level security;
drop policy if exists "own_budget_credit_repayments" on public.budget_credit_repayments;
create policy "own_budget_credit_repayments" on public.budget_credit_repayments
  for all using (auth.uid() = user_id);

create table if not exists public.budget_exceptional_expenses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expense_date date not null,
  description text not null,
  amount numeric(12, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.budget_exceptional_expenses enable row level security;
drop policy if exists "own_budget_exceptional_expenses" on public.budget_exceptional_expenses;
create policy "own_budget_exceptional_expenses" on public.budget_exceptional_expenses
  for all using (auth.uid() = user_id);
