-- Actualización atómica de saldos: evita carreras de leer-en-cliente → escribir.
-- security invoker → aplica RLS de accounts (cada usuario solo toca sus cuentas).
create or replace function public.increment_balance(
  p_account_id uuid,
  p_delta numeric,
  p_clamp_zero boolean default false
)
returns void
language sql
security invoker
as $$
  update public.accounts
  set balance = case
    when p_clamp_zero then greatest(0, balance + p_delta)
    else balance + p_delta
  end
  where id = p_account_id;
$$;
