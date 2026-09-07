# Handoff: Rescue Army — Full App Redesign & New Features

## Overview
Clickable prototype of the Rescue Army mobile app (rescue-army.com), extending the existing Bolt/Expo app with: severity-tiered emergency reports (incl. road accidents), lost & found matching, foster ↔ shelter matching, org onboarding with 501(c)(3)/EIN verification and tax benefits, RescueGroups.org API-synced org directory, Dodo-style rescue stories, Care Fund donations, and trust & safety (verification, moderation, location privacy).

Target codebase: **github.com/giancarlo1972/Pet-Sanctuary** — Expo Router + React Native, `app/(tabs)/` structure, lucide-react-native icons, Supabase (Postgres) backend, deployed via Bolt.

## About the Design Files
`Rescue Army.dc.html` (bundled) is a **design reference built in HTML** — a prototype showing intended look and behavior, NOT production code. Recreate these screens in the Expo/React Native codebase using its existing patterns (`constants/Colors.ts`, `constants/Fonts.ts`, StyleSheet, expo-router, lucide-react-native). Do not port the HTML.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, and copy are final. Recreate pixel-perfectly with React Native primitives.

## Design Tokens
Replace/extend `constants/Colors.ts`:
- navy (primary text/brand): `#26265E`
- coral (accent/CTA): `#E85A50`
- critical red: `#D7443E` (bg `#FDECEB`)
- urgent orange: `#E97F2E` (bg `#FDF1E7`)
- standard yellow: `#E5A415` (bg `#FCF4DF`)
- teal (verified/success): `#2E9E96` (bg `#E4F3F1`, dark text `#1D6D66`)
- background: `#FFFFFF`, screen bg `#FBFBFD`, surface `#F1F2F8` / `#EFF1F5`
- border: `#EEF0F4` (cards), `#E8EAF0` (inputs/chips)
- text secondary: `#6B7280`, tertiary: `#9AA1AC`, body: `#4A4E69`

Typography: Inter (existing). Weights: 800 titles, 700 buttons/names, 600 chips/labels, 400 body.
Sizes: screen titles 20px, section headers 17px, card titles 13.5–14.5px, body 12.5–13.5px, meta 11–12px.
Radii: cards 14–16px, buttons 14px, chips/pills 999px, small tiles 10–12px.
Segmented controls: pill container `#EFF1F5` p4, active segment navy bg / white text.
Tab bar: 5 tabs (Home, Pets, Nearby, Reports, Community), active `#E85A50`, inactive `#9AA1AC`, 22px icons + 10px labels, min hit target 44px.

## Screens / Views

### 0d. Sign in → Home → Me (new flow)
Login never redirects to /admin. Everyone lands on Home; a toast confirms role. Me drawer shows role-gated buttons: platform admin → navy "Open admin console" (/admin); org admin → teal "Manage {org}" (/org-admin). Code + SQL in code/ (two_tier_admin.sql, org-admin.tsx, README-two-tier-admin.md).

### 0e. Add a pet (new, Me → MY PETS → "Add a pet")
3 steps + success. 1) Relationship: My pet / Foster pet / Sponsored pet (sets permissions) + search to claim an existing shelter pet (record transfers). 2) Photo & basics: photo → Claude vision suggestions as chips (species, "AI guess: breed · 87%" teal outline, age range, color swatches, coat; italic "visual guess, not DNA" disclaimer); name, birthday/age, weight, sex. 3) Identity & records (optional): microchip (Private pill, AAHA lookup), upload vaccine records (AI extracts brand/dose/dates), connect Lemonade insurance, primary vet from Nearby. Success: avatar + "Welcome, {name}" → open record. Backend: Edge Functions analyze-pet-photo → pets.ai_traits; parse-pet-document → vaccinations/lab_results/medical_records rows flagged source='ai_extracted' until confirmed; pet-health-analysis → ai_health_analyses. Anthropic key server-side only.


### 0a. Home — Trending now (new)
Between Live alerts and Featured pets: horizontal cards (200px, r14) for community needs. Tag pill (RIDE NEEDED orange / SUPPLIES teal / FOSTER SURGE yellow / VOLUNTEERS navy on soft bgs) + time, title 13/700, meta 11.5 vs coral CTA ("Offer ride →", "Donate →", "Apply →", "Join →") deep-linking to Orgs / Care Fund / Fosters. Backend: community_needs table (type, title, org_id, meta, cta_target, status).

### 0b. Roles & Admin console (new)
Me drawer gets MY ROLE chip selector: Member / First responder / Volunteer / Org admin / Administrator (active navy pill). Org admin + Administrator see the moderation queue; Administrator also gets "Open admin console" (navy button). Admin console (full-screen): navy header "Admin console — full access · all actions logged" + 3 stat tiles (Org reviews / Flagged reports / ID reviews); ORG VERIFICATIONS queue with IRS/EIN match pill (teal "IRS match ✓" / red "No IRS match", nowrap) and Verify org / Reject actions; REPORT MODERATION queue; USER VERIFICATIONS list (responder/volunteer/foster approvals); audit-log notice: every admin action logged with user ID + timestamp, PII/medical access still requires an approved access request. Backend: role column on profiles (or user_roles table), audit_log table.

### 0c. Org detail — EIN gating (new)
EIN row shows masked value (••-••4771 + "Members only" gray pill) unless the viewer is signed in with a relationship (donor, follower, approved foster, member/admin). Enforce via organization_private table + RLS, not client-side.


### 1. Home (`app/(tabs)/index.tsx`)
- Header (all tabs): logo tile 30px navy w/ white paw + "Rescue Army" 15/800 navy · centered screen title 18/800 · "Me" avatar 34px coral circle → opens Profile drawer.
- Emergency banner: `#D7443E` card r14, alert-triangle icon, "See an animal in danger?" 14/700 white + sub 12 `#FBD3D0`, chevron. Tap → New Report flow. (Feature-flaggable.)
- "Live alerts" section: 2 latest reports as rows — 38px icon tile (severity bg/color; car icon for road accidents, alert-triangle otherwise), title 13.5/700 navy ellipsized, "{type} · {SEVERITY}" colored, right-aligned time.
- "Featured pets": horizontal scroll, 170×210 r16 photo cards, bottom gradient `linear-gradient(transparent 45%, rgba(10,10,40,.78))`, name 16/800 white, breed 12, location 11.
- "Rescue stories": horizontal 220px cards — 120px image w/ tag pill (rgba(10,10,40,.7)) top-left + white play button 28px bottom-right; title 13/700, "{org} · {views} views".

### 2. Pets (`app/(tabs)/search.tsx` → rename Pets)
- Filter chips row: All / Dogs / Cats / Needs foster. Active: navy bg white text; inactive: white bg navy text border `#E8EAF0`.
- "All pets" header + "{n} pets" count. 2-col grid, cards r16: 130px image, heart favorite button 30px white circle top-right (fill coral when favorited), "NEEDS FOSTER" teal pill bottom-left when applicable; name 14/700, breed 12, location 11 vs age 11/700 coral.
- **Pet detail** (push route): 290px hero image, back button 36px white circle. Name 22/800 + age coral; breed · location; trait chips (`#F1F2F8`); description 13.5 `#4A4E69` lh1.6; 3 health tiles (Vaccinated / Spayed-neutered / Microchipped) w/ teal checks; shelter card w/ teal shield-check badge "Verified 501(c)(3) · responds in ~2h"; two buttons: "Foster me" (navy outline) + "Adopt {name}" (coral filled).

### 3. Nearby (map tab)
- Full-bleed map (react-native-maps in production). Layer chips overlaid top: Reports / Adoptable pets / Shelters & clinics — active coral bg white text.
- Pins: teardrop 34px, white 2.5px border. Reports: red `!` (critical pulses), orange `!`, yellow `?`. Adoptable: teal w/ count. Shelters: navy/orange w/ initial.
- Bottom sheet (drag handle): "{n} items on map · {layer}", rows w/ 40px colored tile, severity/type pill, title, chevron. Tap → relevant screen.
- **Privacy rule:** public pins for reports show approximate location (~300 m radius circle); exact pins only for verified responders.

### 4. Reports
- Segmented: Reports | Care Fund.
- "New report" full-width coral button.
- Report cards: r14 w/ 4px left border in severity color; severity pill (bg/color per tier) + time; title 14/700; desc 12.5; chips: type (`#EFF1F5`), status (teal, e.g. "3 responders en route"), and for lost pets a filled-teal "2 possible matches found" (photo+collar auto-match).
- Trust note card (`#F1F2F8`, shield icon): "All reports are reviewed by moderators. Exact locations are visible only to verified responders — the public map shows an approximate area."
- **Care Fund tab:** navy hero card — "EMERGENCY CARE FUND" 12/700 letterspaced `#B9BCE0`, "$3,240 of $5,000" 28/800 white, coral progress bar 8px, subline "Covers emergency vet care… · 128 donors this month". Donate row: $10/$25/$50 coral-outline buttons → success state: teal card "Thank you for your donation! Tax-deductible receipt sent — via Happy Paws Shelter, 501(c)(3)". "Recent support" list: avatar initial, name, note, teal amount.

### 5. New Report flow (modal, 4 steps + success)
Progress: 4 bars (done teal, current coral, todo `#E8EAF0`). Footer: Cancel + Continue (coral; disabled `#C7CBD6` until valid; step 4 label "Send alert" in `#D7443E`).
1. **What happened?** 2×2 type cards (icon tile + label + desc + "{SEV} PRIORITY"): Road accident (CRITICAL, car icon), Injured animal (URGENT, heart), Lost or found pet (STANDARD, paw), Cruelty or neglect (URGENT, alert). Selected: 1.5px coral border. Type sets alert priority.
2. **Details:** dashed photo/video upload box (subline "AI identifies the animal automatically"); textarea "Describe the animal and situation…"; optional name input. **AI photo analysis:** once a photo is added (76px thumbnail + "Analyzed in 1.2 s" + Remove link), show an analysis card — sparkle icon + "AI photo analysis" 14/800; trait chips: species (`#F1F2F8` navy), "AI Guess: {breed}" (white bg, teal text + teal 1px border), age range, colors, coat (all `#F1F2F8`); italic disclaimer 11px `#9AA1AC` "AI estimate — may be inaccurate. You can edit any trait."; teal note card "These traits are compared against lost & found reports nearby — **{n} possible match** found already." Backend: photo → vision API (species/breed/age/color/coat) → traits stored on the report and used for lost↔found matching; lost-pet cards show "{n} AI photo matches · {confidence}%" (filled teal pill).
3. **Location & privacy:** map w/ coral pin inside 70px radius circle (rgba(232,90,80,.18)); detected address; toggle card (eye-off icon) "Show approximate location publicly — Public map shows a ~300 m area. Exact pin is shared only with verified responders." Toggle: 44×26, teal when on.
4. **Review & send:** key/value card (Type, Priority in severity color, Location, Privacy in teal) + moderation warning: "Reports are moderated in minutes. Deliberate false reports lead to account suspension."
Success: teal check circle, "Alert sent", "3 verified responders and 2 shelters within 1 mile were notified…", navy "Track my report" button.

### 6. Community
Segmented: Orgs | Fosters | Stories.
- **Orgs:** API banner (`#F1F2F8`, pulsing teal dot): "**Connected to RescueGroups.org API** — {n} organizations synced · updated 5 min ago". Type filter chips (All/Shelters/Rescue groups/Clinics/Sponsors). "Register your organization" dashed CTA ("Get verified · unlock 501(c)(3) tax benefits for donors"). Org rows: 44px initial tile (brand color), name + teal shield-check if verified, "{type} · {meta}", status pill (teal "501(c)(3) verified" / yellow "Care Fund partner" / gray "Verification pending"), chevron.
- **Org detail** (push): navy header — back, 54px initial tile, name 17/800 white + badge, "{type} · {city}", 3 stat tiles (Pets listed / Adoptions / Followers, rgba(255,255,255,.1)). Body: description; info card rows (Status colored, EIN, Address, Data source teal — "RescueGroups.org API" or "Registered directly"); horizontal strip of that org's pets (110×96 r14) → pet detail; Follow (navy outline, toggles to filled "Following ✓") + Donate (coral → Care Fund).
- **Fosters:** teal info card "Matches are based on your foster profile — home type, schedule, experience, and other pets." Match cards: 64px pet photo, name + "{92%} match" teal pill, breed · via org, need description; footer split buttons "View profile" | "Apply to foster" (→ "Applied ✓" teal).
- **Stories:** vertical cards, 160px image, tag pill, play button; title 14.5/800; "{org} · {views} views · {time}". **Story detail** (push): 250px hero w/ centered play, title 19/800, body 13.5 lh1.65, "Share this rescue" chips: The Dodo, Instagram Reels, TikTok, Copy link (share icon coral); footnote "Sharing drives adoptions — stories shared to media partners reach an average of 40k viewers."

### 7. Register Organization flow (modal, 4 steps)
Same progress/footer pattern.
1. **Type:** 2×2 — Shelter (building, navy), Rescue group (heart, teal), Clinic (activity, orange), Sponsor (shield, yellow).
2. **Details:** inputs — Legal organization name, EIN (12-3456789), Website/social, Primary address. (Existing app also has phone/contact — keep.)
3. **Verification & tax benefits:** 3 info cards — "IRS 501(c)(3) check" (EIN matched against IRS exempt-org registry; verified badge across app), "Deductible donations" (automatic tax-deductible receipts via Care Fund), "Sponsor benefits" (write-off docs + co-branded story placements); dashed "Upload IRS determination letter (optional)".
4. **Pending state:** yellow clock circle, "Verification pending", "checking your EIN against the IRS registry — usually 1–2 business days. You can already post pets; the verified badge appears once approved."

### 8. Profile / Me drawer (right slide-over, 86% width, scrim rgba(15,15,40,.35))
- Avatar, name + verified shield, "Verified rescuer · Manhattan, NY".
- TRUST & VERIFICATION list: Government ID ✓ Verified (teal pill), Phone ✓, Responder training "In review" (yellow pill).
- PRIVACY: default approximate-location toggle.
- MY BADGES chips: First responder, 12 rescues assisted, Foster ready.
- MODERATION QUEUE (org-admin role only): flagged items w/ Approve (teal) / Reject (red outline) → resolved state.

## Interactions & Behavior
- Tab switches reset overlays. Overlays: pet detail, story detail, org detail, report flow, org flow, profile drawer.
- Report flow: Continue disabled until a type is chosen (step 1); back steps within flow, exits at step 1.
- Favorites, follows, foster applications, donations, moderation actions are optimistic toggles.
- Toggles animate 200ms; critical map pin pulses (opacity 1→.45, 1.6s loop).
- Deep links: Home "View all"→Reports; "See all"→Community/Stories; org Donate→Care Fund; map rows→respective screens.

## State Management / Data (Supabase)
Suggested tables (RLS on all):
- `reports`: id, reporter_id, type (road_accident|injured|lost_found|cruelty), severity (critical|urgent|standard — derived from type), description, photo_urls[], ai_traits jsonb (species, breed_guess, age_range, colors[], coat, confidence — from the vision API), lat, lng, approx_public boolean (default true), status (pending_moderation|active|resolved|rejected), created_at. **RLS: exact lat/lng readable only by verified responders + moderators; public view exposes a geohash/rounded coords (~300 m).**
- `report_matches`: report_id, matched_report_id, score numeric (AI trait + photo similarity), status (suggested|confirmed|dismissed).
- `organizations`: id, name, type (shelter|rescue_group|clinic|sponsor), ein, address, website, verified boolean, verification_status (pending|verified|rejected), source (rescuegroups_api|direct), stats jsonb, created_at.
- `org_verifications`: org_id, ein_checked_at, irs_registry_match boolean, determination_letter_url, reviewer_id.
- `foster_profiles`: user_id, home_type, schedule, experience, has_pets jsonb.
- `foster_matches`: pet_id, user_id, score numeric, status (suggested|applied|accepted).
- `stories`: id, org_id, pet_id, title, body, media_urls[], views, shared_to jsonb.
- `donations`: id, user_id, org_id, amount, receipt_sent boolean, tax_deductible boolean.
- `user_verifications`: user_id, id_verified, phone_verified, responder_training (none|in_review|passed).
- `moderation_queue`: id, subject_type, subject_id, flag_reason, status, reviewer_id.
- RescueGroups.org API sync: scheduled edge function upserting `organizations` (+ pets) with `source='rescuegroups_api'`, storing `last_synced_at` for the banner.

## Assets
- Photos: pexels.com placeholders (ids 1056251, 1805164, 1170986, 1490908, 1108099, 617278) — replace with real pet photos from DB/API.
- Icons: all lucide (paw-print, home, map-pin, alert-triangle, users, heart, shield, car, camera, eye-off, building-2, activity, share, play, clock, check) — already in the codebase via lucide-react-native.
- Map: stylized placeholder in the prototype — use react-native-maps / Mapbox in production.

## Files
- `Rescue Army Prototype (standalone).html` — the full clickable prototype, self-contained: open it in any browser by double-clicking (pet photos load from the network, so be online).
- `screenshots/` — 14 labeled captures: home, pets grid, pet detail, nearby map, reports list, report flow (type step, location & privacy step, AI photo analysis), care fund, community orgs, org detail, foster matches, stories, profile drawer. Captures show the top of each screen; open the prototype for full scrollable views.
