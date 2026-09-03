/*
# Add severity column to reports + create care_cases table

## Changes

### 1. reports table — new column
- `severity` (text, nullable, values: 'critical' | 'urgent' | 'standard')
  - Added to support the Reports tab grouping by severity level.
  - Existing rows get NULL severity (treated as 'standard' by the app).

### 2. New table: care_cases
- `id` (uuid, PK, default gen_random_uuid())
- `created_at` (timestamptz, default now())
- `pet_name` (text) — name of the pet the fund is for
- `species` (text) — species of the pet
- `photo_url` (text) — photo of the pet
- `story` (text) — story/description of the case
- `goal_amount` (numeric, default 0) — fundraising goal
- `raised_amount` (numeric, default 0) — amount raised so far
- `status` (text, default 'active') — active | funded | closed
- `organization_id` (uuid, FK to organizations, nullable) — owning org
- `created_by` (uuid, FK to auth.users, nullable) — creator

### 3. Security
- care_cases: RLS enabled.
  - SELECT: public to authenticated (anyone signed in can browse care cases).
  - INSERT: authenticated only, must set created_by = auth.uid().
- reports: GRANT SELECT on severity column to anon + authenticated
  (column-level grant pattern used by this table).

## Notes
1. No existing data is modified or deleted — severity defaults to NULL.
2. care_cases is read-only from the public app for now; the "Help fund"
   button is a placeholder (Stripe Connect integration comes later).
3. The severity column is nullable so existing reports remain valid.
*/

ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS severity text;

GRANT SELECT (severity) ON public.reports TO anon;
GRANT SELECT (severity) ON public.reports TO authenticated;

-- Check if organizations table exists before creating care_cases FK
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'care_cases') THEN
    CREATE TABLE public.care_cases (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at timestamptz DEFAULT now(),
      pet_name text NOT NULL,
      species text,
      photo_url text,
      story text,
      goal_amount numeric DEFAULT 0,
      raised_amount numeric DEFAULT 0,
      status text DEFAULT 'active',
      organization_id uuid,
      created_by uuid
    );

    ALTER TABLE public.care_cases ENABLE ROW LEVEL SECURITY;

    -- Allow authenticated users to read care cases
    DROP POLICY IF EXISTS "care_cases_select_authenticated" ON public.care_cases;
    CREATE POLICY "care_cases_select_authenticated"
      ON public.care_cases FOR SELECT
      TO authenticated
      USING (true);

    -- Allow authenticated users to create care cases they own
    DROP POLICY IF EXISTS "care_cases_insert_own" ON public.care_cases;
    CREATE POLICY "care_cases_insert_own"
      ON public.care_cases FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = created_by);

    -- Add FK to organizations if the table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organizations') THEN
      ALTER TABLE public.care_cases
        ADD CONSTRAINT care_cases_organization_id_fkey
        FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;
    END IF;

    -- Add FK to auth.users
    ALTER TABLE public.care_cases
      ADD CONSTRAINT care_cases_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;
