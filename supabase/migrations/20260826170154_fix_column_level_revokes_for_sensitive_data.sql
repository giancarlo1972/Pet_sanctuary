/*
# Fix column-level protection for microchip_number and ein

Table-level GRANT SELECT overrides column-level REVOKE.
Must revoke table-level SELECT, then re-grant at column level
excluding the sensitive columns.
*/

-- === pets: protect microchip_number ===
REVOKE SELECT ON pets FROM anon;
REVOKE SELECT ON pets FROM authenticated;

-- Re-grant all columns EXCEPT microchip_number
GRANT SELECT (
  id, shelter_id, name, breed, species, age_text, gender, status,
  description, personality, good_with_kids, good_with_dogs, good_with_cats,
  vaccinated, spayed_neutered, microchipped, main_photo_url, location,
  created_at, updated_at, owner_id
) ON pets TO anon, authenticated;

-- === organizations: protect ein ===
REVOKE SELECT ON organizations FROM anon;
REVOKE SELECT ON organizations FROM authenticated;

-- Re-grant all columns EXCEPT ein
GRANT SELECT (
  id, created_at, name, org_type, status, description, address, city, state,
  website, contact_email, phone, logo_url, verification_doc_url, created_by
) ON organizations TO anon, authenticated;
