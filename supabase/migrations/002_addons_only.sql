-- FinPilot — addons only (tables already exist)
-- Run this if you already created the tables manually.

-- 1. Add missing columns to existing tables
alter table profiles add column if not exists theme text not null default 'light';
alter table profiles add column if not exists currency text not null default 'EUR';

-- 2. Enums (safe to ignore if exist)
do $$ begin
  create type activity_type as enum ('alternance', 'cle_avenir', 'hakily', 'personnel');
exception when duplicate_object then null; end $$;

do $$ begin
  create type transaction_type as enum ('income', 'expense');
exception when duplicate_object then null; end $$;

do $$ begin
  create type budget_period as enum ('monthly', 'quarterly', 'yearly');
exception when duplicate_object then null; end $$;

-- 3. RLS
alter table profiles    enable row level security;
alter table categories  enable row level security;
alter table transactions enable row level security;
alter table documents   enable row level security;
alter table budgets     enable row level security;
alter table goals       enable row level security;

-- 4. Policies (drop & recreate)
drop policy if exists "own_profile"              on profiles;
drop policy if exists "own_categories"           on categories;
drop policy if exists "read_default_categories"  on categories;
drop policy if exists "own_transactions"         on transactions;
drop policy if exists "own_documents"            on documents;
drop policy if exists "own_budgets"              on budgets;
drop policy if exists "own_goals"                on goals;

create policy "own_profile"             on profiles     for all using (auth.uid() = id);
create policy "own_categories"          on categories   for all using (auth.uid() = user_id);
create policy "read_default_categories" on categories   for select using (is_default = true);
create policy "own_transactions"        on transactions for all using (auth.uid() = user_id);
create policy "own_documents"           on documents    for all using (auth.uid() = user_id);
create policy "own_budgets"             on budgets      for all using (auth.uid() = user_id);
create policy "own_goals"               on goals        for all using (auth.uid() = user_id);

-- 5. Auto-create profile on signup
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 6. Updated_at trigger
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists profiles_updated_at on profiles;
create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

drop trigger if exists transactions_updated_at on transactions;
create trigger transactions_updated_at before update on transactions
  for each row execute function set_updated_at();

-- 7. Default categories (only if none exist)
insert into categories (user_id, activity, type, name, icon, color, is_default)
select * from (values
  (null::uuid, null::activity_type, 'income'::transaction_type, 'Salaire',                 '💼', '#6366f1', true),
  (null, null,         'income',  'Freelance',                '🤝', '#8b5cf6', true),
  (null, null,         'income',  'Remboursement',            '↩️', '#06b6d4', true),
  (null, 'alternance', 'income',  'Rémunération alternance',  '🎓', '#6366f1', true),
  (null, 'cle_avenir', 'income',  'Prestation CléAvenir',     '🏢', '#f59e0b', true),
  (null, 'hakily',     'income',  'Mission Hakily',           '🤖', '#10b981', true),
  (null, null,         'expense', 'Loyer',                    '🏠', '#ef4444', true),
  (null, null,         'expense', 'Courses',                  '🛒', '#f97316', true),
  (null, null,         'expense', 'Transport',                '🚇', '#eab308', true),
  (null, null,         'expense', 'Loisirs',                  '🎮', '#ec4899', true),
  (null, null,         'expense', 'Santé',                    '🏥', '#14b8a6', true),
  (null, null,         'expense', 'Abonnements',              '📱', '#8b5cf6', true),
  (null, null,         'expense', 'Restaurant',               '🍽️', '#f97316', true),
  (null, 'cle_avenir', 'expense', 'Logiciels',                '💻', '#6366f1', true),
  (null, 'cle_avenir', 'expense', 'Marketing',                '📣', '#f59e0b', true),
  (null, 'hakily',     'expense', 'API & Infra IA',           '🔌', '#10b981', true),
  (null, null,         'expense', 'Formation',                '📚', '#06b6d4', true),
  (null, null,         'expense', 'Matériel',                 '🖥️', '#78716c', true),
  (null, null,         'expense', 'Comptabilité',             '📊', '#6366f1', true)
) as v(user_id, activity, type, name, icon, color, is_default)
where not exists (select 1 from categories where is_default = true);

-- 8. Storage bucket for documents
insert into storage.buckets (id, name, public)
  values ('documents', 'documents', false)
  on conflict (id) do nothing;

drop policy if exists "upload_own_documents" on storage.objects;
drop policy if exists "read_own_documents"   on storage.objects;
drop policy if exists "delete_own_documents" on storage.objects;

create policy "upload_own_documents" on storage.objects for insert
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "read_own_documents" on storage.objects for select
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "delete_own_documents" on storage.objects for delete
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
