-- Optional lifestyle row written by document extraction (Food card).
CREATE TABLE IF NOT EXISTS public.pet_lifestyle (
  pet_id uuid PRIMARY KEY REFERENCES public.pets(id) ON DELETE CASCADE,
  diet text,
  food_brand text,
  food_product text,
  food_type text,
  parasite_prevention text,
  source text,
  confirmed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pet_lifestyle ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pl_owner ON public.pet_lifestyle;
CREATE POLICY pl_owner ON public.pet_lifestyle FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_lifestyle.pet_id AND p.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.pet_relationships pr WHERE pr.pet_id = pet_lifestyle.pet_id AND pr.user_id = auth.uid() AND pr.ended_on IS NULL)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_lifestyle.pet_id AND p.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.pet_relationships pr WHERE pr.pet_id = pet_lifestyle.pet_id AND pr.user_id = auth.uid() AND pr.ended_on IS NULL)
  );
GRANT SELECT, INSERT, UPDATE ON public.pet_lifestyle TO authenticated;

ALTER TABLE public.pet_diet ADD COLUMN IF NOT EXISTS source text;
