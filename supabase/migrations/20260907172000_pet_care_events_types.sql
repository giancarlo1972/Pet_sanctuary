-- Normalize unknown event types, then add a check that matches live data.
UPDATE pet_care_events
SET event_type = 'other'
WHERE event_type IS NULL
   OR btrim(event_type) = ''
   OR event_type NOT IN (
     'weight','visit','procedure','vaccination','medication','lab','note','grooming','other',
     'spay_neuter','test_result','microchip_implanted','parasite_treatment'
   );

ALTER TABLE pet_care_events DROP CONSTRAINT IF EXISTS pet_care_events_event_type_check;
ALTER TABLE pet_care_events ADD CONSTRAINT pet_care_events_event_type_check
  CHECK (event_type IN (
    'weight','visit','procedure','vaccination','medication','lab','note','grooming','other',
    'spay_neuter','test_result','microchip_implanted','parasite_treatment'
  ));
