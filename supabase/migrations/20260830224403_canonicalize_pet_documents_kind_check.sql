/*
# Canonicalize pet_documents.kind CHECK constraint

## Problem
The live CHECK constraint on pet_documents.kind accepts 14 values including
synonyms (vet_record vs medical_record, imaging_other vs other_imaging,
plus adoption_contract, insurance, license, photo, other). The client now
uses exactly 7 canonical values matching the UI buttons. This migration
tightens the constraint to match.

## Changes
- Drop the existing pet_documents_kind_check constraint.
- Add a new pet_documents_kind_check allowing only the 7 canonical values:
  vaccination_record, medical_record, xray, ultrasound, lab_result,
  other_imaging, other_document.

## Data Safety
- Existing rows use only 'medical_record' (2 rows) and 'xray' (1 row),
  both of which are in the new allowed set. No data is lost or altered.
*/

ALTER TABLE pet_documents DROP CONSTRAINT IF EXISTS pet_documents_kind_check;

ALTER TABLE pet_documents ADD CONSTRAINT pet_documents_kind_check
  CHECK (kind IN ('vaccination_record', 'medical_record', 'xray', 'ultrasound', 'lab_result', 'other_imaging', 'other_document'));
