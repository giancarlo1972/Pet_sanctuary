/*
# Allow adopters to read their own adoptions and follow-ups

Both tables have Row Level Security enabled but no SELECT policy, so no client
can currently read them. This migration adds read-only policies so a signed-in
adopter can see their own adoption records and the follow-up milestones tied to
those adoptions. No write access is added, and no existing policy is changed.

1. Policies
  - `adoptions`: SELECT for authenticated where `adopter_id = auth.uid()`.
  - `follow_ups`: SELECT for authenticated where the linked adoption belongs to
    the current user.

2. Notes
  - Read-only. Insert/update/delete remain denied (no policies for them).
  - Idempotent: policies are dropped first if present.
*/

DROP POLICY IF EXISTS "select_own_adoptions" ON public.adoptions;
CREATE POLICY "select_own_adoptions" ON public.adoptions
  FOR SELECT TO authenticated
  USING (adopter_id = auth.uid());

DROP POLICY IF EXISTS "select_own_follow_ups" ON public.follow_ups;
CREATE POLICY "select_own_follow_ups" ON public.follow_ups
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adoptions a
      WHERE a.id = follow_ups.adoption_id
        AND a.adopter_id = auth.uid()
    )
  );
