CREATE TABLE public.month_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  year int NOT NULL,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  closed_at timestamptz DEFAULT now(),
  UNIQUE (user_id, year, month)
);

ALTER TABLE public.month_closures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own closures" ON public.month_closures FOR ALL USING (auth.uid() = user_id);
