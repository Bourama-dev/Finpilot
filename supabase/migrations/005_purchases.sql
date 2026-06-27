-- Achats planifiés
create table if not exists public.purchases (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  amount numeric(12, 2) not null check (amount > 0),
  activity activity_type not null default 'personnel',
  category text not null default 'Autre',
  -- 'comptant' | '3x' | '4x' | 'credit'
  payment_mode text not null default 'comptant'
    check (payment_mode in ('comptant', '3x', '4x', 'credit')),
  -- frais d'échelonnement en % (ex. 2.5 pour 2,5 %)
  installment_fees_pct numeric(5, 2) not null default 0
    check (installment_fees_pct >= 0),
  -- nombre de mensualités pour le mode crédit (null = mode fixe 3x/4x)
  credit_months integer check (credit_months is null or credit_months >= 2),
  -- 'high' | 'medium' | 'low'
  priority text not null default 'medium'
    check (priority in ('high', 'medium', 'low')),
  -- 'planned' | 'in_progress' | 'done' | 'cancelled'
  status text not null default 'planned'
    check (status in ('planned', 'in_progress', 'done', 'cancelled')),
  target_date date,
  purchase_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.purchases enable row level security;

drop policy if exists "own_purchases" on public.purchases;
create policy "own_purchases" on public.purchases
  for all using (auth.uid() = user_id);

drop trigger if exists purchases_updated_at on public.purchases;
create trigger purchases_updated_at before update on public.purchases
  for each row execute function public.set_updated_at();
