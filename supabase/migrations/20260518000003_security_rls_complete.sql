-- Habilitar RLS y políticas completas en tablas creadas fuera de migraciones

-- accounts
alter table public.accounts enable row level security;
drop policy if exists "users_own_accounts" on public.accounts;
create policy "users_own_accounts" on public.accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- recurring_income
alter table public.recurring_income enable row level security;
drop policy if exists "users_own_recurring_income" on public.recurring_income;
create policy "users_own_recurring_income" on public.recurring_income
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- income
alter table public.income enable row level security;
drop policy if exists "users_own_income" on public.income;
create policy "users_own_income" on public.income
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Añadir WITH CHECK a políticas existentes que solo tenían USING
-- (protege INSERT/UPDATE — impide insertar filas con user_id ajeno)

drop policy if exists "users see own categories" on public.categories;
create policy "users_own_categories" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users see own expenses" on public.expenses;
create policy "users_own_expenses" on public.expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users see own budgets" on public.budgets;
create policy "users_own_budgets" on public.budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users see own goals" on public.goals;
create policy "users_own_goals" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users see own closures" on public.month_closures;
create policy "users_own_month_closures" on public.month_closures
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
