# Desktop layout rule — apply to EVERY screen (Sep 7)

## Problem
Screens are phone layouts stretched to full browser width: full-bleed hero with navy letterbox bars, cards spanning 1600px, text at the far left. Some screens (pet-care) use a different column width than others.

## One rule, one component
Create `components/Page.tsx` and wrap every screen's content in it:

```tsx
import { View, ScrollView, useWindowDimensions, StyleSheet } from 'react-native';
export const CONTENT_MAX = 720;            // phone-first content column
export function Page({ children, scroll = true, wideMax = CONTENT_MAX }: { children: React.ReactNode; scroll?: boolean; wideMax?: number }) {
  const { width } = useWindowDimensions();
  const inner = <View style={[s.col, { maxWidth: wideMax }]}>{children}</View>;
  return scroll ? <ScrollView contentContainerStyle={s.scroll}>{inner}</ScrollView> : <View style={s.scroll}>{inner}</View>;
}
const s = StyleSheet.create({
  scroll: { flexGrow: 1, alignItems: 'center', paddingBottom: 48 },
  col: { width: '100%', paddingHorizontal: 16, gap: 14 },
});
```
- Default `maxWidth 720` for content screens (pet-details, pet-record, reports, community, admin, org-admin, profile).
- Home may use `wideMax={1080}` with a wrapping grid for Featured pets.
- AppHeader inner row: same `maxWidth` centered, so back/Me align with content.
- Bottom action bars (Message / Application draft): same column width, not edge-to-edge.

## Hero images (pet-details, pet-record)
Never full-bleed with letterbox on desktop:
```tsx
<Image source={{ uri }} style={{ width: '100%', aspectRatio: 4/3, borderRadius: 20 }} resizeMode="cover" />
```
Sits inside the column (top margin 12) — the same image block on phone and desktop. Back / favorite / share buttons overlay the image corners.

## Tabs
Two segmented styles are in use (pill-in-track on pet-care, underline on pet-record). Standardize on the pill chips from the Pets filter row (navy active, white inactive, border #E8EAF0), horizontally scrollable.

## Photo edit (owner's own pets)
pet-record header: pencil on the avatar → ImagePicker → ImageManipulator resize 1600 / 0.8 → upload `pet-photos/{pet_id}/{ts}.jpg` → `pets.main_photo_url = path`. Render via signed URL (private pets) or public URL (adoptable).

## Checklist per screen
- [ ] wrapped in <Page>
- [ ] no full-bleed hero / letterbox
- [ ] chips/pills style matches Pets filter row
- [ ] no hardcoded demo data (see P0-pet-care-demo-data.md)
