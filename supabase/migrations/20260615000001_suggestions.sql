create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null check (char_length(trim(text)) between 1 and 1000),
  status text not null default 'pending' check (status in ('pending', 'planned', 'done', 'declined')),
  created_at timestamptz not null default now()
);

alter table public.suggestions enable row level security;

create policy "users_own_suggestions" on public.suggestions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index suggestions_user_created_idx on public.suggestions (user_id, created_at desc);
