-- Link expenses to accounts so balance deduction is exact (not proportional)
alter table public.expenses
  add column account_id uuid references public.accounts(id) on delete set null;
