-- Categories table
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  icon text not null default '💰',
  color text not null default '#6366f1',
  created_at timestamptz default now()
);

-- Expenses table
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  category_id uuid references public.categories(id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  description text,
  date date not null default current_date,
  created_at timestamptz default now()
);

-- Budgets table (monthly or weekly per category or global)
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  category_id uuid references public.categories(id) on delete cascade,
  period text not null check (period in ('monthly', 'weekly')) default 'monthly',
  amount numeric(12,2) not null check (amount > 0),
  year int not null,
  month int check (month between 1 and 12),
  week int check (week between 1 and 53),
  created_at timestamptz default now(),
  unique (user_id, category_id, period, year, month, week)
);

-- Goals table
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  target_amount numeric(12,2) not null check (target_amount > 0),
  current_amount numeric(12,2) not null default 0 check (current_amount >= 0),
  deadline date,
  icon text default '🎯',
  completed boolean default false,
  created_at timestamptz default now()
);

-- Row Level Security
alter table public.categories enable row level security;
alter table public.expenses enable row level security;
alter table public.budgets enable row level security;
alter table public.goals enable row level security;

-- RLS Policies: each user only sees their own data
create policy "users see own categories" on public.categories for all using (auth.uid() = user_id);
create policy "users see own expenses" on public.expenses for all using (auth.uid() = user_id);
create policy "users see own budgets" on public.budgets for all using (auth.uid() = user_id);
create policy "users see own goals" on public.goals for all using (auth.uid() = user_id);

-- Default categories for new users (inserted via trigger)
create or replace function public.create_default_categories()
returns trigger language plpgsql security definer as $$
begin
  insert into public.categories (user_id, name, icon, color) values
    (new.id, 'Alimentación', '🍽️', '#f59e0b'),
    (new.id, 'Transporte', '🚌', '#3b82f6'),
    (new.id, 'Vivienda', '🏠', '#8b5cf6'),
    (new.id, 'Salud', '💊', '#ef4444'),
    (new.id, 'Entretenimiento', '🎬', '#ec4899'),
    (new.id, 'Ropa', '👕', '#14b8a6'),
    (new.id, 'Educación', '📚', '#f97316'),
    (new.id, 'Otros', '📦', '#6b7280');
  return new;
end;
$$;

create trigger on_user_created
  after insert on auth.users
  for each row execute function public.create_default_categories();
