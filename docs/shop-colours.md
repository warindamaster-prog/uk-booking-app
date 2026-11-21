# Shop colours

Status (21 Nov 2026): **ON** (`SHOP_COLORS_ENABLED=true` in Vercel). Migration `0020_shop_colour.sql` was applied to the live database on 21 Nov 2026 (owner approved): scope is the dashboard and the booking pages, ready-made palettes.

## What it does
- The owner picks one of 8 palettes (green = default, blue, violet, rose, red, orange, teal, slate) in Settings, with a small preview.
- The colour is used in the shop's dashboard and on its customers' booking pages (buttons, selected menu item, step bar, icons, links, focus ring).
- Stored in `businesses.accent_color` (a palette name; null = the default green).

## How it works
- `src/lib/theme.ts`: the palettes (built from a hue and saturation, tuned for contrast; a test checks white on the main colour, text on the soft colours, and the icon colour) and `themeStyle()`, which returns the CSS variables for a page.
- The green was written straight into the class names. Every accent colour in the dashboard and booking pages now reads `[color:var(--brand,#34553e)]`-style values: the variable if the shop chose a colour, otherwise the original green as the fallback. So the default look is unchanged, and the sign-in pages and landing page (no variables) keep our own green.
- Roles: `--brand` (buttons, active step), `--brand-hover`, `--brand-soft` (selected backgrounds), `--brand-softer`, `--brand-border`, `--brand-text`, `--brand-ring` (focus), `--brand-on` (icon on the main colour), and the page greys tinted with the same hue: `--brand-ink` (main text), `--brand-muted` (secondary text), `--brand-line` (borders), `--brand-bg` (page and light surfaces). Amber warning boxes and the near-white header and sidebar stay as they are.
- The variables are set on the root of the dashboard (`src/app/dashboard/layout.tsx`) and the booking pages (`PublicShell`).
- While the switch is off, nothing reads the column (the queries leave `accent_color` out), so the live site works without the migration.

## Going live
1. Owner approves, then apply `0020_shop_colour.sql` to the live database.
2. Set `SHOP_COLORS_ENABLED=true` in Vercel and redeploy.
3. Check Settings > Colour: choose a colour, see the dashboard change, open the shop's booking page.

## Not covered
- Emails keep the standard look. The landing and sign-in pages stay in our green.
- No free colour picker (palettes only, so text always stays readable).
