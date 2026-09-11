-- Report details: grant the columns the screen reads. Do NOT grant contact_*.
-- Those stay revoked so the details query can select from reports only.

DO $$
DECLARE col text;
BEGIN
  FOREACH col IN ARRAY ARRAY[
    'photo_url', 'user_id', 'severity', 'animal_kind', 'last_seen_at',
    'colors', 'life_stage', 'size', 'gender', 'approximate_public',
    'allow_direct_contact', 'pet_id', 'ai_species', 'ai_breed', 'ai_colors',
    'ai_coat', 'ai_confidence', 'ai_summary', 'ai_age_range', 'ai_analyzed_at',
    'ai_priority', 'ai_risk_tags'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'reports' AND column_name = col
    ) THEN
      EXECUTE format('GRANT SELECT (%I) ON public.reports TO anon, authenticated', col);
    END IF;
  END LOOP;
END $$;
