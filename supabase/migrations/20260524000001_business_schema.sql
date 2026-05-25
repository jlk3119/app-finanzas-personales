-- Business schema migration
-- Adds multi-tenant company model, clients and orders tables,
-- and migrates all existing tables from user_id to company_id scoping.

-- ─── 1. Core company tables ───────────────────────────────────────────────

create table public.companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  nit        text,
  join_code  text not null unique default upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_at timestamptz default now()
);

create table public.company_members (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('owner', 'employee')) default 'employee',
  created_at timestamptz default now(),
  unique (company_id, user_id)
);

-- ─── 2. Add company_id to all existing tables ─────────────────────────────

alter table public.categories      add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.expenses         add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.budgets          add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.accounts         add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.income           add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.recurring_income add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.month_closures   add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.debts            add column if not exists company_id uuid references public.companies(id) on delete cascade;

-- ─── 3. New business tables ───────────────────────────────────────────────

create table public.clients (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  name         text not null,
  contact_name text,
  email        text,
  phone        text,
  notes        text,
  created_at   timestamptz default now()
);

create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  client_id       uuid references public.clients(id) on delete set null,
  description     text not null,
  total_value     numeric(14,2) not null check (total_value >= 0),
  advance_payment numeric(14,2) not null default 0 check (advance_payment >= 0),
  status          text not null check (status in ('pending', 'in_progress', 'delivered', 'cancelled')) default 'pending',
  order_date      date not null default current_date,
  delivery_date   date,
  notes           text,
  created_at      timestamptz default now()
);

-- ─── 4. RLS helper function ───────────────────────────────────────────────

create or replace function public.is_company_member(cid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.company_members
    where company_id = cid and user_id = auth.uid()
  );
$$;

-- ─── 5. RLS on company tables ─────────────────────────────────────────────

alter table public.companies enable row level security;

create policy "members_see_company" on public.companies
  for select using (public.is_company_member(id));

create policy "members_can_update_company" on public.companies
  for update using (
    exists (select 1 from public.company_members
            where company_id = id and user_id = auth.uid() and role = 'owner')
  );

-- companies: anyone authenticated can insert (to create their company)
create policy "authenticated_can_create_company" on public.companies
  for insert with check (auth.uid() is not null);

alter table public.company_members enable row level security;

create policy "members_see_membership" on public.company_members
  for select using (user_id = auth.uid() or public.is_company_member(company_id));

create policy "authenticated_can_join" on public.company_members
  for insert with check (user_id = auth.uid());

create policy "owner_can_delete_members" on public.company_members
  for delete using (
    user_id = auth.uid() or
    exists (select 1 from public.company_members m2
            where m2.company_id = company_id and m2.user_id = auth.uid() and m2.role = 'owner')
  );

-- ─── 6. Updated RLS on all data tables (company-scoped) ───────────────────

-- categories
drop policy if exists "users_own_categories" on public.categories;
drop policy if exists "Users can manage own categories" on public.categories;
create policy "company_members_own_categories" on public.categories
  for all using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

-- expenses
drop policy if exists "users_own_expenses" on public.expenses;
drop policy if exists "Users can manage own expenses" on public.expenses;
create policy "company_members_own_expenses" on public.expenses
  for all using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

-- budgets
drop policy if exists "users_own_budgets" on public.budgets;
drop policy if exists "Users can manage own budgets" on public.budgets;
create policy "company_members_own_budgets" on public.budgets
  for all using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

-- accounts
drop policy if exists "users_own_accounts" on public.accounts;
drop policy if exists "Users can manage own accounts" on public.accounts;
create policy "company_members_own_accounts" on public.accounts
  for all using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

-- income
drop policy if exists "users_own_income" on public.income;
drop policy if exists "Users can manage own income" on public.income;
create policy "company_members_own_income" on public.income
  for all using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

-- recurring_income
drop policy if exists "users_own_recurring_income" on public.recurring_income;
drop policy if exists "Users can manage own recurring_income" on public.recurring_income;
create policy "company_members_own_recurring_income" on public.recurring_income
  for all using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

-- month_closures
drop policy if exists "users_own_month_closures" on public.month_closures;
drop policy if exists "Users can manage own month_closures" on public.month_closures;
create policy "company_members_own_month_closures" on public.month_closures
  for all using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

-- debts
drop policy if exists "users_own_debts" on public.debts;
drop policy if exists "Users can manage own debts" on public.debts;
create policy "company_members_own_debts" on public.debts
  for all using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

-- clients
alter table public.clients enable row level security;
create policy "company_members_own_clients" on public.clients
  for all using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

-- orders
alter table public.orders enable row level security;
create policy "company_members_own_orders" on public.orders
  for all using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

-- ─── 7. Default business categories trigger ───────────────────────────────

create or replace function public.create_default_business_categories()
returns trigger language plpgsql security definer as $$
begin
  insert into public.categories (company_id, name, icon, color, is_system) values
    (new.id, 'Operativo',      '⚙️',  '#6366f1', true),
    (new.id, 'Materiales',     '🧱',  '#f59e0b', true),
    (new.id, 'Servicios',      '🔧',  '#3b82f6', true),
    (new.id, 'Marketing',      '📢',  '#ec4899', true),
    (new.id, 'Administración', '📋',  '#8b5cf6', true),
    (new.id, 'Transporte',     '🚚',  '#14b8a6', true),
    (new.id, 'Nómina',         '👥',  '#10b981', true);
  return new;
end;
$$;

create trigger on_company_created
  after insert on public.companies
  for each row execute function public.create_default_business_categories();

-- ─── 8. Join code lookup RPC ──────────────────────────────────────────────

create or replace function public.get_company_by_join_code(code text)
returns table(id uuid, name text) language sql security definer stable as $$
  select id, name from public.companies where join_code = upper(code) limit 1;
$$;
