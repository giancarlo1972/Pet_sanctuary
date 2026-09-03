/*
# Application decision function and column-level protection

## Purpose
Applicants must not be able to approve/decline their own applications.
Shelter members need a privileged path to set status, decided_at,
reviewed_by, and reviewer_notes.

## Changes
1. Revoke full UPDATE on foster_applications from anon and authenticated.
2. Grant UPDATE on applicant-writable columns only to authenticated
   (all form fields + status + submitted_at, but NOT decided_at,
   reviewed_by, or reviewer_notes).
3. Replace the fa_update policy with one that adds a WITH CHECK:
   shelter members can set any status, applicants can only set
   draft/submitted/withdrawn.
4. Create a SECURITY DEFINER function decide_foster_application()
   that shelter members call to approve or decline. Sets status,
   decided_at, reviewed_by, reviewer_notes in one atomic operation.
5. Grant EXECUTE on the function to authenticated.

## Security
- Applicants can no longer write reviewer_notes, reviewed_by, or
  decided_at through the client.
- Applicants can no longer set status to approved/declined (WITH CHECK
  rejects it).
- Shelter members must call the SECURITY DEFINER function, which
  verifies membership before mutating.
*/

-- === 1. Column-level UPDATE restrictions ===
REVOKE UPDATE ON public.foster_applications FROM anon;
REVOKE UPDATE ON public.foster_applications FROM authenticated;

GRANT UPDATE (
  message, home_type, has_other_pets, experience,
  applicant_name, applicant_email, applicant_phone,
  address_line, city, state, postal_code,
  is_adult, housing_type, owns_home, landlord_name, landlord_phone, pets_allowed,
  adults_count, children_ages, hours_alone, has_fenced_yard,
  vet_clinic_name, vet_phone,
  answers, home_visit_consent, attestation_signed_name,
  status, submitted_at
) ON public.foster_applications TO authenticated;

-- === 2. Replace UPDATE policy with WITH CHECK ===
DROP POLICY IF EXISTS "fa_update" ON public.foster_applications;

CREATE POLICY "fa_update" ON public.foster_applications FOR UPDATE
  TO authenticated
  USING (
    applicant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM pets p
      JOIN shelter_members sm ON sm.shelter_id = p.shelter_id
      WHERE p.id = foster_applications.pet_id AND sm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pets p
      JOIN shelter_members sm ON sm.shelter_id = p.shelter_id
      WHERE p.id = foster_applications.pet_id AND sm.user_id = auth.uid()
    )
    OR (applicant_id = auth.uid() AND status IN ('draft', 'submitted', 'withdrawn'))
  );

-- === 3. SECURITY DEFINER function for shelter-member decisions ===
CREATE OR REPLACE FUNCTION public.decide_foster_application(
  p_application_id uuid,
  p_decision text,
  p_notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_decision NOT IN ('approved', 'declined') THEN
    RAISE EXCEPTION 'Invalid decision value';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM foster_applications fa
    JOIN pets p ON p.id = fa.pet_id
    JOIN shelter_members sm ON sm.shelter_id = p.shelter_id
    WHERE fa.id = p_application_id AND sm.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE foster_applications
  SET status = p_decision,
      decided_at = now(),
      reviewed_by = auth.uid(),
      reviewer_notes = p_notes
  WHERE id = p_application_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decide_foster_application TO authenticated;
