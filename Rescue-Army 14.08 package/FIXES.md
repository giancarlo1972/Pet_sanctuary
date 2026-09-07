# Rescue Army — Fixes for developer (Sep 7, 2026)

## 1. Sign out button does nothing (profile.tsx)
```tsx
const signOut = async () => {
  await supabase.auth.signOut({ scope: 'local' });
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.assign('/');   // hard reload resets AuthContext
    return;
  }
  router.replace('/(tabs)');
};
```
Also make sure AuthContext subscribes to `supabase.auth.onAuthStateChange` and that `onPress={signOut}` is on the TouchableOpacity itself.

## 2. Private pets leaking into Home/Pets (is_public overriding listing_type)
```sql
UPDATE pets SET is_public = false WHERE listing_type = 'private';
ALTER TABLE pets DROP CONSTRAINT IF EXISTS pets_private_not_public;
ALTER TABLE pets ADD CONSTRAINT pets_private_not_public
  CHECK (NOT (listing_type = 'private' AND is_public = true));
DROP POLICY IF EXISTS pets_public_adoptable ON pets;
CREATE POLICY pets_public_adoptable ON pets FOR SELECT TO anon, authenticated
  USING (listing_type = 'adoptable' AND is_public = true AND shelter_id IS NOT NULL);
-- duplicate Auroras (keep e1fc97c6…)
DELETE FROM pets WHERE id IN ('dc226cb0-bc6c-4c61-b58b-470aeb56df27','644b187e-a4ed-404b-af10-d762b47f616d');
```
add-pet.tsx: never send `is_public: true`; always set `owner_id = auth.uid()`, `listing_type = 'private'`. Only org staff create `adoptable` pets.

## 3. "Failed to load" pet images
add-pet.tsx saves a device URI. Upload to Storage instead:
```ts
const path = `${user.id}/${Date.now()}.jpg`;
await supabase.storage.from('pet-photos').upload(path, file, { contentType: 'image/jpeg' });
// store `path` in pets.main_photo_url; render with:
const { data } = await supabase.storage.from('pet-photos').createSignedUrl(path, 3600);
```
(public bucket is fine for adoptable pets; private pets should use signed URLs)

## 4. Admin console (admin.tsx)
- Remove dev ghost buttons "Invoices by role" and "Gina care record".
- Remove dev chips row on Home (Pet record / Invoices / Admin / Updates). Admin lives in Me (role-gated).
- Organizations list: pending rows show **Verify · Reject** inline; verified rows show **Assign admin**; every row has ⋮ → edit sheet (name/type/city, remove logo, Approve / Suspend / Reject / Delete with confirm). Actions:
```ts
const setStatus = (id, status) => supabase.from('organizations').update({ status }).eq('id', id);
const removeLogo = (id) => supabase.from('organizations').update({ logo_url: null }).eq('id', id);
const remove = (id) => supabase.from('organizations').delete().eq('id', id);
```
- "0 Org reviews" while pending orgs exist → run `code/two_tier_admin.sql` (adds `platform_admin_orgs` RLS so admins can read pending orgs); confirm status values are lowercase `pending`.
- Duplicate check on org registration: normalize name + EIN → "This organization already exists — request to join instead".

## 5. Desktop layout
- admin.tsx / org-admin.tsx: `col: { maxWidth: 880, alignSelf: 'center', padding: 24 }`; org list 2 columns when width >= 900.
- Home: wrap content `maxWidth: 1080, alignSelf: 'center'`; Featured pets → flexWrap grid on desktop.
- AppHeader: constrain inner row to the same maxWidth so back/Me align with content.
- Reword map card subline: "Directions & ride options to the nearest 24h ER".

## 6. URL noise `?__EXPO_ROUTER_key=undefined-…`
Use `router.replace`/`navigate` (not `push`) for /admin, and in `app/_layout.tsx`:
```tsx
useEffect(() => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (url.searchParams.has('__EXPO_ROUTER_key')) {
    url.searchParams.delete('__EXPO_ROUTER_key');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  }
}, []);
```

## 7. Login flow
Login → always Home. Remove /admin redirect + first-admin auto-promotion from auth.tsx / AuthForm.tsx. Me shows role-gated buttons: platform admin → "Open admin console"; org admin → "Manage {org}" (/org-admin). OAuth redirectTo = origin `/`; update Supabase Auth URL config.

## 8. ai_health_analyses RLS
```sql
CREATE POLICY aha_select ON ai_health_analyses FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM pets p WHERE p.id = ai_health_analyses.pet_id AND (
    p.owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = p.shelter_id AND om.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM record_access_requests rar WHERE rar.pet_id = p.id
               AND rar.requester_id = auth.uid() AND rar.scope = 'medical' AND rar.status = 'approved'))));
```
Inserts only from the `pet-health-analysis` Edge Function (service role).

## 9. Colors.ts regression
Restore handoff tokens: coral #E85A50 / #D7443E / bg #FDECEB · teal #2E9E96 / #1D6D66 / bg #E4F3F1 · navy #26265E · critical #D7443E · urgent #E97F2E (#FDF1E7) · standard #E5A415 (#FCF4DF) · screen #FBFBFD · surface #F1F2F8 · text #26265E · textSecondary #6B7280 · textTertiary #9AA1AC · border #EEF0F4 · borderInput #E8EAF0.
