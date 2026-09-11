# Rescue Army smoke (run before every push)

Sign in as `giancarlo.pereira@gmail.com` on the **local** static build
(`npx expo export --platform web` served from `dist/`). Record PASS/FAIL
and the value seen. **Any FAIL blocks the push.**

Set `SMOKE_PASSWORD` in the environment for the signed-in checks (6–11).
Never commit it.

Set `SMOKE_PASSWORD` in the environment for the signed-in checks (6–11).
Never commit it.

## Checks

1. **Home** renders; Trending ≥ 1 card.
2. **Pets** grid ≥ 6 cards, 2 columns.
3. **Nearby:** tiles render (no “API KEY”); Shelters layer > 0.
4. **Reports:** 4 count tiles (All / Critical / Urgent / Mine); New report → submit signed-out succeeds.
5. **Community → Orgs** ≥ 40 rows; open one → detail loads.
6. **Me:** Pets tile = 3, Shared with me = 1 (Aurora), Sign out visible.
7. **Gina:** tabs Overview · Lifestyle · Health · Insurance · Documents · Clinics; With-you-since = Jun 15, 2022; Weight 18.5 lb · BCS 8.
8. **Gina Documents:** counts Labs 17 / Vaccines 16 / Records 9, not equal to each other.
9. **Aurora Documents:** 1 record, 0 imaging, 0 insurance; scan label shows that file’s page count.
10. **Upload** a 1-page vaccine card image → Confirm sheet shows ≥ 1 vaccine.
11. **Platform → Pets** search keeps focus while typing.
12. `npx tsc --noEmit` and `npx expo export --platform web` both exit 0.

## Database

Schema, RLS, and policy changes go through **migrations only**.

- Add a file under `supabase/migrations/YYYYMMDDHHMMSS_*.sql`.
- Never hand-paste SQL in the dashboard, chat, or a one-off script.
- After adding the file, paste it once for the human to run in the Supabase SQL editor.
- Hand-pasted policy edits are what drifted `pets` SELECT into recursion with `pet_relationships`.
