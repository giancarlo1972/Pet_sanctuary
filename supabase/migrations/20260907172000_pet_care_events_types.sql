ALTER TABLE pet_care_events DROP CONSTRAINT IF EXISTS pet_care_events_event_type_check;
ALTER TABLE pet_care_events ADD CONSTRAINT pet_care_events_event_type_check
  CHECK (event_type IN ('weight','visit','procedure','vaccination','medication','lab','note','grooming','other'));
