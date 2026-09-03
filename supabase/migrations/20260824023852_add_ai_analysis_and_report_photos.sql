/*
  # AI photo analysis columns + report photo storage

  1. Reports table changes
    - Add `ai_analysis` (jsonb, nullable): the structured result returned by the
      AI photo analysis (species, breed guesses, colors, coat, marks, etc.).
    - Add `ai_analyzed_at` (timestamptz, nullable): when the analysis completed.
      A row with a photo but a null `ai_analyzed_at` is still "Analyzing".

  2. Column privileges
    - The reports table uses column-level SELECT grants (the table-wide grant was
      revoked earlier to hide reporter contact details). The two new columns are
      not covered by the old grants, so we explicitly GRANT SELECT on them to the
      `anon` and `authenticated` roles so the app can read the analysis back.
    - Writes to these columns happen only inside the edge function using the
      service role, which bypasses these grants.

  3. Storage
    - Create a public `report-photos` bucket to hold uploaded report images so the
      analysis edge function can download them by public URL.
    - Allow anon + authenticated to upload to and read from that bucket (reports
      can be filed without signing in). Objects are publicly readable.

  4. Notes
    - Idempotent: columns added only if missing; bucket insert uses ON CONFLICT;
      policies dropped before create.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reports' AND column_name = 'ai_analysis'
  ) THEN
    ALTER TABLE public.reports ADD COLUMN ai_analysis jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reports' AND column_name = 'ai_analyzed_at'
  ) THEN
    ALTER TABLE public.reports ADD COLUMN ai_analyzed_at timestamptz;
  END IF;
END $$;

GRANT SELECT (ai_analysis, ai_analyzed_at) ON public.reports TO anon;
GRANT SELECT (ai_analysis, ai_analyzed_at) ON public.reports TO authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('report-photos', 'report-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "report_photos_read" ON storage.objects;
CREATE POLICY "report_photos_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'report-photos');

DROP POLICY IF EXISTS "report_photos_insert" ON storage.objects;
CREATE POLICY "report_photos_insert"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'report-photos');
