-- Reminder-only rows are not vaccinations
DELETE FROM pet_vaccinations WHERE administered_on IS NULL;

-- Gina DOB was stored as 2022-12-17 from a D/M swap of 5/17/2022
UPDATE pets
SET date_of_birth = '2022-05-17'
WHERE name ILIKE 'gina'
  AND date_of_birth IN ('2022-12-17', '2022-17-05');
