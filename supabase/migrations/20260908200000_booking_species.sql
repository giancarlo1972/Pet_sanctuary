-- Booking requests share species (dog/cat) by default.
-- A named pet profile is attached only when the owner opts in.
-- Run in Supabase SQL Editor. Idempotent.

ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS species text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pet_relationships'
  ) THEN
    EXECUTE 'ALTER TABLE pet_relationships ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS pr_owner_share ON pet_relationships';
    EXECUTE $p$
      CREATE POLICY pr_owner_share ON pet_relationships FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (SELECT 1 FROM pets p WHERE p.id = pet_id AND p.owner_id = auth.uid())
        OR user_id = auth.uid()
      )
    $p$;
    EXECUTE 'GRANT INSERT, SELECT ON pet_relationships TO authenticated';
  END IF;
END $$;
