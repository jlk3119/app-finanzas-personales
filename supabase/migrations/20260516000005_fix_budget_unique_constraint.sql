-- Eliminar registros duplicados de presupuestos
-- Se conserva el registro más reciente (mayor id) por (user_id, category_id, period, year, month, week)
DELETE FROM public.budgets a
USING public.budgets b
WHERE a.id < b.id
  AND a.user_id = b.user_id
  AND (a.category_id = b.category_id OR (a.category_id IS NULL AND b.category_id IS NULL))
  AND a.period = b.period
  AND a.year = b.year
  AND (a.month = b.month OR (a.month IS NULL AND b.month IS NULL))
  AND (a.week = b.week OR (a.week IS NULL AND b.week IS NULL));

-- Reemplazar el UNIQUE constraint estándar (que no previene NULL=NULL duplicados)
-- con uno que trate NULL como igual (PostgreSQL 15+, disponible en Supabase)
ALTER TABLE public.budgets
  DROP CONSTRAINT IF EXISTS budgets_user_id_category_id_period_year_month_week_key;

ALTER TABLE public.budgets
  ADD CONSTRAINT budgets_unique_per_period
  UNIQUE NULLS NOT DISTINCT (user_id, category_id, period, year, month, week);
