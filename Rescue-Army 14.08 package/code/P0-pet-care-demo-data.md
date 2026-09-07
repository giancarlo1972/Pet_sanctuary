# P0 — pet-care.tsx is a demo screen, not a data screen (Sep 7)

## Symptoms
- Every pet (any user) shows Gina's photo, 18.3 lb, chip 900263003877863, FELV/vaccine chips, SiiPet demo telemetry.
- Photo cannot be changed; new pets on other accounts render Gina's record.
- Screen width/tab style differ from the rest of the app (960px column, pill segmented control, dark letterboxed hero).

## Root cause
`app/pet-care.tsx` was built from the prototype with hardcoded demo constants and never wired to Supabase for anything except name/breed.

## Fix (replace, don't patch)
1. Delete `app/pet-care.tsx`. Use `code/pet-record.tsx` from this package as `app/pet-record.tsx` — it reads every field from the DB and has empty states.
2. Route: My Pets rows + add-pet success → `/pet-record?id=<pet.id>`. Remove any link to /pet-care.
3. Photo: header uses `pets.main_photo_url` (signed URL if private bucket). Add "Change photo" (pencil) → ImageManipulator resize 1600px / 0.8 → upload `pet-photos/{pet_id}/{ts}.jpg` → update `main_photo_url`.
4. Chips only when true: `FELV negative` from a lab_results row (analyte='FeLV', flag='normal'); `Microchipped` when pet_identifiers row exists; `Vaccinated` when ≥1 confirmed vaccination.
5. Devices: render the SiiPet card ONLY if a `pet_devices` row exists for this pet; otherwise a single "Connect a device" row. No demo telemetry anywhere.
6. Layout: same container as every other screen — `maxWidth 560` (880 on ≥900px), underline tabs like pet-details, hero image `aspectRatio 4/3, borderRadius 16, resizeMode cover` — no navy letterbox.
7. Grep the repo for literals and delete every hit: `18.3`, `900263003877863`, `LitterLens`, `FELV negative`, `First responder`, `12 rescues assisted`, `Foster ready`.

## Verify
Create a pet on a fresh incognito account: record must show that pet's name/photo, "No weight recorded", "No microchip on file", no vaccine chips, no device card. Then open Gina on your account and confirm her real data still shows.
