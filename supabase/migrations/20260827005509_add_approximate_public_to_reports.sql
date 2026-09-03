ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS approximate_public boolean NOT NULL DEFAULT true;
