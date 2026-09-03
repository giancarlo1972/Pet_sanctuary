/*
# Backfill pet_relationships for owner-created pets

## Purpose
Any pet created by a user (with `owner_id` set) that does NOT already have a
`pet_relationships` row gets an 'owner' relationship row so the pet appears
under "My Pets" on the profile page.

## What it does
1. Inserts a `pet_relationships` row (relationship = 'owner', started_on = today)
   for every pet that has a non-null `owner_id` and no existing relationship row
   for that user/pet pair.

## Safety
- Only inserts, never deletes or updates existing rows.
- Idempotent: uses NOT EXISTS check so re-running won't create duplicates.
- No RLS or policy changes.
*/

INSERT INTO pet_relationships (pet_id, user_id, relationship, started_on)
SELECT p.id, p.owner_id, 'owner', CURRENT_DATE
FROM pets p
WHERE p.owner_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM pet_relationships pr
    WHERE pr.pet_id = p.id
      AND pr.user_id = p.owner_id
      AND pr.relationship = 'owner'
  );
