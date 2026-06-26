-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Enums
create type activity_type as enum ('alternance', 'cle_avenir', 'hakily', 'personnel');
create type transaction_type as enum ('income', 'expense');
create type budget_period as enum ('monthly', 'quarterly', 'yearly');
create type recurring_frequency as enum ('daily', 'weekly', 'monthly', 'yearly');

-- Profiles (extends auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  currency text not null default 'EUR',
  theme text not null default 'light',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Categories
create table categories (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  activity activity_type,
  type transaction_type not null,
  name text not null,
  icon text,
  color text,
  budget_monthly numeric(12, 2),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- Transactions
create table transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  activity activity_type not null,
  type transaction_type not null,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'EUR',
  category text not null,
  description text,
  date date not null,
  is_recurring boolean not null default false,
  recurring_frequency recurring_frequency,
  tags text[],
  notes text,
  document_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Documents
create table documents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  activity activity_type,
  name text not null,
  type text not null,
  size integer not null,
  storage_path text not null unique,
  tags text[],
  created_at timestamptz not null default now()
);

-- Add FK from transactions to documents
alter table transactions
  add constraint fk_transaction_document
  foreign key (document_id) references documents(id) on delete set null;

-- Budgets
create table budgets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  activity activity_type not null,
  category text not null,
  amount numeric(12, 2) not null check (amount > 0),
  period budget_period not null default 'monthly',
  year integer not null,
  month integer check (month between 1 and 12),
  created_at timestamptz not null default now(),
  unique (user_id, activity, category, period, year, month)
);

-- Goals
create table goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  target_amount numeric(12, 2) not null check (target_amount > 0),
  current_amount numeric(12, 2) not null default 0,
  deadline date,
  color text,
  icon text,
  description text,
  is_completed boolean not null default false,
  created_at timestamptz not null default now()
);

-- Row Level Security
alter table profiles enable row level security;
alter table categories enable row level security;
alter table transactions enable row level security;
alter table documents enable row level security;
alter table budgets enable row level security;
alter table goals enable row level security;

-- Policies
create policy "own_profile" on profiles for all using (auth.uid() = id);
create policy "own_activities" on categories for all using (auth.uid() = user_id);
create policy "read_default_categories" on categories for select using (is_default = true);
create policy "own_transactions" on transactions for all using (auth.uid() = user_id);
create policy "own_documents" on documents for all using (auth.uid() = user_id);
create policy "own_budgets" on budgets for all using (auth.uid() = user_id);
create policy "own_goals" on goals for all using (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Updated_at trigger
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger transactions_updated_at before update on transactions
  for each row execute function set_updated_at();

-- Seed default categories
insert into categories (user_id, activity, type, name, icon, color, is_default) values
  -- Income
  (null, null, 'income', 'Salaire', '💼', '#6366f1', true),
  (null, null, 'income', 'Freelance', '🤝', '#8b5cf6', true),
  (null, null, 'income', 'Remboursement', '↩️', '#06b6d4', true),
  (null, 'alternance', 'income', 'Rémunération alternance', '🎓', '#6366f1', true),
  (null, 'cle_avenir', 'income', 'Prestation CléAvenir', '🏢', '#f59e0b', true),
  (null, 'hakily', 'income', 'Mission Hakily', '🤖', '#10b981', true),
  -- Expense personal
  (null, null, 'expense', 'Loyer', '🏠', '#ef4444', true),
  (null, null, 'expense', 'Courses', '🛒', '#f97316', true),
  (null, null, 'expense', 'Transport', '🚇', '#eab308', true),
  (null, null, 'expense', 'Loisirs', '🎮', '#ec4899', true),
  (null, null, 'expense', 'Santé', '🏥', '#14b8a6', true),
  (null, null, 'expense', 'Abonnements', '📱', '#8b5cf6', true),
  (null, null, 'expense', 'Restaurant', '🍽️', '#f97316', true),
  -- Expense pro
  (null, 'cle_avenir', 'expense', 'Logiciels', '💻', '#6366f1', true),
  (null, 'cle_avenir', 'expense', 'Marketing', '📣', '#f59e0b', true),
  (null, 'hakily', 'expense', 'API & Infra IA', '🔌', '#10b981', true),
  (null, null, 'expense', 'Formation', '📚', '#06b6d4', true),
  (null, null, 'expense', 'Matériel', '🖥️', '#78716c', true),
  (null, null, 'expense', 'Comptabilité', '📊', '#6366f1', true);

-- Storage bucket for documents
insert into storage.buckets (id, name, public)
  values ('documents', 'documents', false)
  on conflict (id) do nothing;

create policy "upload_own_documents"
  on storage.objects for insert
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "read_own_documents"
  on storage.objects for select
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "delete_own_documents"
  on storage.objects for delete
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
