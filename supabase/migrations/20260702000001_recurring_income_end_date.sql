-- Fecha de finalización de ingresos recurrentes (último mes activo, inclusive).
-- NULL = sin fecha de fin (vigente indefinidamente).
alter table public.recurring_income
  add column if not exists end_date date;
