# Rescue Army smoke (run before every push)

**Any FAIL blocks the push.**

## Who runs what

Grok runs **1–5 (public)** and **12** against the local `dist/` export.
It cannot sign in as `giancarlo.pereira@gmail.com` — no password in this
environment.

**You** run **4 (signed-out submit)** after the matching migration is
applied, plus **6–11** and **13–15** signed in on hub-preview. Reply with PASS/FAIL
and the value seen, one line each. Grok pushes only after those lines
are PASS.

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
13. **Upload BondVet invoice** → Bills tile shows `1 · $X.XX`. Confirm sheet reads `1 invoice · $X total · N line items` (not a wall of raw numbers).
14. **Add community pet** → appears in Me → My Pets → Community, and on Nearby → Community (teal outline pin).
15. **Transfer Nina** to a test account → accept → Nina under the new owner, Gina unaffected.

## Database

Schema, RLS, and policy changes go through **migrations only**.

- Add a file under `supabase/migrations/YYYYMMDDHHMMSS_*.sql`.
- Never hand-paste SQL in the dashboard, chat, or a one-off script —
  except the one-time paste of that file so you can run it.
- After adding the file, paste it once for the human to run in the
  Supabase SQL editor.
- Hand-pasted policy edits are what drifted `pets` SELECT into
  recursion with `pet_relationships`.
