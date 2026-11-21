-- A shop's colour: the name of one of the ready-made palettes (src/lib/theme.ts). null = the default green.
-- Used in the shop's dashboard and on its customers' booking pages. Existing shops stay on the default.
-- Proposal: docs/shop-colours.md. Applied to the live database on 21 Nov 2026.
alter table public.businesses
  add column accent_color text check (accent_color is null or accent_color in ('blue', 'violet', 'rose', 'red', 'orange', 'teal', 'slate'));

grant update (accent_color) on public.businesses to authenticated;
