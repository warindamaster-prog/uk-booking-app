/**
 * A shop's colour: one of a few ready-made palettes. Each palette is tuned so white text on the main colour and dark text on the
 * soft colours stay easy to read (a test checks the contrast). The greys of the pages (text, borders, backgrounds) are tinted with the same hue, so a shop's page does not keep a green cast. The default green sets no variables at all: every colour in the pages
 * has the green as its fallback, so a shop that never chooses looks exactly as before.
 */
export const shopColorsEnabled = () => process.env.SHOP_COLORS_ENABLED === "true";

export type ThemeName = "green" | "blue" | "violet" | "rose" | "red" | "orange" | "teal" | "slate" | "mono";

export const THEMES: { name: ThemeName; label: string; hue: number; sat: number }[] = [
  { name: "green", label: "Green", hue: 134, sat: 26 },
  { name: "blue", label: "Blue", hue: 214, sat: 52 },
  { name: "violet", label: "Violet", hue: 262, sat: 40 },
  { name: "rose", label: "Rose", hue: 338, sat: 48 },
  { name: "red", label: "Red", hue: 4, sat: 55 },
  { name: "orange", label: "Orange", hue: 22, sat: 62 },
  { name: "teal", label: "Teal", hue: 176, sat: 56 },
  { name: "slate", label: "Slate", hue: 215, sat: 14 },
  { name: "mono", label: "Black & white", hue: 0, sat: 0 },
];

export const THEME_NAMES = THEMES.map((t) => t.name) as [ThemeName, ...ThemeName[]];
export const isThemeName = (v: unknown): v is ThemeName => typeof v === "string" && (THEME_NAMES as string[]).includes(v);

function hsl(h: number, s: number, l: number): string {
  const sat = s / 100, light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export type Palette = { brand: string; hover: string; soft: string; softer: string; border: string; text: string; ring: string; on: string; ink: string; muted: string; line: string; bg: string };

export function paletteFor(name: ThemeName): Palette {
  // Black and white: true greys, no tint at all.
  if (name === "mono") return { brand: "#111111", hover: "#333333", soft: "#ebebeb", softer: "#f5f5f5", border: "#8a8a8a", text: "#111111", ring: "#444444", on: "#ffffff", ink: "#111111", muted: "#595959", line: "#e2e2e2", bg: "#fafafa" };
  const t = THEMES.find((x) => x.name === name) ?? THEMES[0];
  return {
    brand: hsl(t.hue, t.sat, 25), hover: hsl(t.hue, t.sat, 19), soft: hsl(t.hue, t.sat * 0.6, 92), softer: hsl(t.hue, t.sat * 0.5, 96),
    border: hsl(t.hue, t.sat * 0.5, 58), text: hsl(t.hue, t.sat, 24), ring: hsl(t.hue, t.sat, 40), on: hsl(t.hue, t.sat * 0.4, 94),
    ink: hsl(t.hue, t.sat * 0.4, 16), muted: hsl(t.hue, t.sat * 0.2, 40), line: hsl(t.hue, t.sat * 0.25, 89), bg: hsl(t.hue, t.sat * 0.3, 96),
  };
}

/** The inline style that applies a shop's colour to a page. Nothing for the default (or an unknown value): the fallbacks apply. */
export function themeStyle(name: string | null | undefined): Record<string, string> | undefined {
  if (!shopColorsEnabled() || !isThemeName(name) || name === "green") return undefined;
  const p = paletteFor(name);
  return { "--brand": p.brand, "--brand-hover": p.hover, "--brand-soft": p.soft, "--brand-softer": p.softer, "--brand-border": p.border, "--brand-text": p.text, "--brand-ring": p.ring, "--brand-on": p.on, "--brand-ink": p.ink, "--brand-muted": p.muted, "--brand-line": p.line, "--brand-bg": p.bg };
}
