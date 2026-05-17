-- Link goals to a default source budget category
ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL;
