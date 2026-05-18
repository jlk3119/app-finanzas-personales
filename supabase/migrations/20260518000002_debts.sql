create table public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  entity text not null,
  total_amount numeric(14,2) not null,
  paid_amount numeric(14,2) not null default 0,
  icon text not null default '💳',
  color text not null default '#ef4444',
  notes text,
  created_at timestamptz not null default now()
);

alter table public.debts enable row level security;

create policy "users_own_debts" on public.debts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
