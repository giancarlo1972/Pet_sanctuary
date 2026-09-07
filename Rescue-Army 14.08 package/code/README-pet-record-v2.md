# Pet record v2 — implementation notes

## Files
- `pet_record_v2.sql` → Supabase SQL Editor. New tables (weight_entries, vaccinations w/ brand·dose·lot·reactions, lab_results, pet_documents, pet_devices, device_readings, ai_health_analyses) + `can_read_pet_medical()` RLS. Then create a **private** Storage bucket `pet-documents`.
- `functions/parse-pet-document.ts` → `supabase/functions/parse-pet-document/index.ts`
- `functions/pet-health-analysis.ts` → `supabase/functions/pet-health-analysis/index.ts`
  - `supabase secrets set ANTHROPIC_API_KEY=…` — key lives ONLY in Edge Function secrets.
  - deploy: `supabase functions deploy parse-pet-document pet-health-analysis`
- `pet-record.tsx` → replaces `app/pet-record.tsx`. Needs `expo-document-picker`.

## Behavior
- Tabs: Overview / Insurance / Medical. Medical shows the health-summary hero (vet visits this year, conditions, weight vs target) and sub-pills Records · Labs · History · AI Health.
- **Upload record** (Records/Labs) → uploads to `pet-documents` → calls `parse-pet-document` → Claude returns vaccinations/labs rows with `confirmed=false` → yellow "AI extracted N items — confirm" card → owner taps Confirm. Unconfirmed rows never feed AI Health.
- **AI Health** → `pet-health-analysis` reasons across confirmed labs, weights, vaccinations, history, last 30 days of device readings → findings (attention / watch / good) + data-quality flags. Red disclaimer always on top; "Share analysis with my vet" stamps `shared_with_vet_at`.
- Microchip comes from `pet_identifiers` — RLS decides if the viewer sees it; fosters see "request access".
- Weight is **lb everywhere**. Entry UI must convert kg→lb on save. (Current bug: 18.3 kg shown as 40.3 lb / 18.3 kg mixed.)

## Migrate existing Gina data
- Move old `medical_records` rows of type vaccination → `vaccinations` (brand/dose from notes).
- Delete the placeholder "Rabies, FVRCP — Given: Date unknown" row.
- `weight_entries`: fix any value < 12 saved as kg → ×2.20462.

## Also remove from old screen
- "This pet is lost" red button → move to ⋮ menu as "Report lost".
- Duplicate breed line on My Pets card.
