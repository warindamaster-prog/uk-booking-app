-- Adds "mono" (black and white) to the shop colours (src/lib/theme.ts).
alter table public.businesses drop constraint businesses_accent_color_check;
alter table public.businesses
  add constraint businesses_accent_color_check
  check (accent_color is null or accent_color in ('blue', 'violet', 'rose', 'red', 'orange', 'teal', 'slate', 'mono'));
