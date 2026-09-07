# Claude Code kickoff — Rescue Army (paste this as the first message)

You are working in the repo `giancarlo1972/Pet_sanctuary` (Expo Router + React Native web, Supabase, deployed by Cloudflare Pages: `main` → rescue-army.com, `hub-preview` → hub-preview.pet-sanctuary.pages.dev). Work on branch `hub-preview`. Commit after each numbered step with a clear message. Never push to `main`.

A design package is in the repo root folder `Rescue-Army 14.08 package/` (if missing, I'll upload it). Read, in this order, before touching code:
1. `README.md` — screen specs and tokens
2. `code/DESKTOP-LAYOUT.md`, `code/P0-pet-care-demo-data.md`, `FIXES.md`
3. `code/README-pet-record-v2.md`, `code/README-two-tier-admin.md`
Open `Rescue Army Prototype (standalone).html` in a browser as the visual reference (Me → My Pets → Gina for the pet record; Me → role chips → admin consoles).

## Hard rules
- Every value on screen comes from Supabase or shows an explicit empty state. No demo constants (grep and delete: `18.3`, `900263003877863`, `LitterLens`, `First responder`, `12 rescues assisted`, `Foster ready`).
- Never send `owner_id`, `is_public` or `availability` for personal pets from the client; personal pets are `listing_type='private'`.
- Photos: compress (ImageManipulator 1600px / 0.8) → upload to Storage → store the storage path. Never store a device URI.
- Design tokens are `constants/Colors.ts` — restore to the values in FIXES.md §9 if they differ.
- After each step: `npx expo export -p web` must succeed, and you tell me what to open on hub-preview to verify.

## Steps
1. **Layout foundation.** Create `components/Page.tsx` per DESKTOP-LAYOUT.md (720px centered column, 880 opt-in). Constrain `AppHeader` to the same width. Wrap: index, pets, reports, community, profile, pet-details, pet-record, admin, org-admin, auth. Home uses `wideMax={1080}` with the horizontal-scroll-on-phone / wrap-grid-on-desktop Featured pets. Remove the dev chip row (Pet record / Invoices / Admin / Updates) from Home.
2. **Pet record.** Diff `app/pet-record.tsx` against `code/pet-record.tsx` and bring in everything missing: health-summary hero, Records/Labs/History/AI Health sub-pills, vaccination cards with brand·dose·lot·clinic·reactions·valid-thru, "AI extracted — confirm" review card, Labs grouped by panel with flags, AI Health with red disclaimer + Run analysis + Share with vet, Insurance tab (empty → Connect Lemonade / Upload PDF / Forward email → AI review → active policy card + claims). Keep the Photos gallery on Overview. Hero `aspectRatio 4/3`, `maxHeight 360`, pencil → change photo. Delete `app/pet-care.tsx` and any route to it.
3. **Add pet.** Rewrite `app/add-pet.tsx` as the 3-step flow (README §0e): relationship → photo + AI traits (call `/api/analyze-pet-photo`; if it doesn't exist, create it in the Cloudflare functions folder using the same pattern as `/api/parse-pet-document`) → identity & records. Success → `/pet-record?petId=…`. Remove Availability / Visible-to-public from this flow; those belong only to the org "List a pet" form.
4. **Auth & profile.** Login always lands on Home (remove `/admin` redirect and first-admin auto-promotion). Sign-out: `signOut({scope:'local'})` then `window.location.assign('/')`; `AuthContext` subscribes to `onAuthStateChange`. Me drawer: role-gated buttons "Open admin console" (`profiles.role='admin'`) and "Manage {org}" (`organization_members.role='admin'` → `/org-admin`). MY BADGES from real data or hidden. Strip `__EXPO_ROUTER_key` in `_layout.tsx` per FIXES.md §6.
5. **Admin.** `admin.tsx`: Organizations list must read `id, name, org_type, status, logo_url` (EIN lives in `organization_private`); pending rows show Verify · Reject, verified rows Assign admin, ⋮ opens edit sheet (name/type/city, remove logo, Approve/Suspend/Reject/Delete-with-confirm). Empty copy: "No organizations yet". Add `app/org-admin.tsx` from `code/org-admin.tsx`. Remove the "Invoices by role" / "Gina care record" ghost buttons.
6. **Data safety pass.** Confirm these SQL files have been applied (ask me to run any that haven't, in this order): `code/two_tier_admin.sql`, `code/pet_record_v2.sql`, `code/insurance.sql`; plus FIXES.md §2 (pets `listing_type`/`is_public` constraint) and §8 (`ai_health_analyses` RLS). Storage: `pet-photos` public read; `pet-documents` private with the `can_read_pet_medical` policies.

## Acceptance test (run before you say done)
- Incognito, brand-new account: Home shows only shelter pets; add a pet → record shows *that* pet's photo and empty states everywhere else; Me shows no badges and no admin buttons; sign out actually signs out.
- My account (giancarlo.pereira@gmail.com): Gina shows her real photos, vaccines with brand/dose, Insurance flow, AI Health runs; Me shows "Open admin console"; admin lists all organizations.
- Desktop 1440px and phone 390px both look like the prototype: one column width, aligned header, no letterboxed heroes, no stretched cards.
- Cloudflare Deployments shows the latest `hub-preview` commit built green, and the preview URL reflects it (hard refresh).

Report back after each step with: commit hash, what to open, what to expect.

---
## Current repo state (as of 2026-09-07 08:40 EDT) — do not ignore
- `hub-preview` HEAD: `a32c5e3`
- `main` HEAD: `2cf6318` (production). **Do not push main.**
- Preview URL: Cloudflare Pages → this project → Deployments → Preview / `hub-preview`. Expected: `https://hub-preview.pet-sanctuary.pages.dev` — confirm in the dashboard; if the project slug differs, use the Preview URL on that row.
- Already on hub-preview (diff before rewriting): `components/Page.tsx`, AppHeader `maxWidth`, `app/pet-care.tsx` deleted, routes go to `/pet-record?petId=`, admin org select without `ein`, photo compress in `lib/prepare-image.ts`, Cloudflare functions `analyze-pet-photo` / `parse-pet-document` / `pet-health-analysis`.
- Package path in this repo: `Rescue-Army 14.08 package/`
- Production URL (do not treat as the work URL): https://rescue-army.com
