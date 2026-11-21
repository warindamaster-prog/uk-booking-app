import { afterEach, describe, expect, it } from "vitest";
import { isThemeName, paletteFor, THEMES, themeStyle } from "../theme";

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

describe("shop colour palettes", () => {
  for (const t of THEMES) {
    it(`${t.name}: white on the main colour and dark text on the soft colours are easy to read`, () => {
      const p = paletteFor(t.name);
      expect(contrast("#ffffff", p.brand), "white on brand").toBeGreaterThanOrEqual(7);
      expect(contrast("#ffffff", p.hover), "white on hover").toBeGreaterThanOrEqual(7);
      expect(contrast(p.text, "#ffffff"), "text on white").toBeGreaterThanOrEqual(7);
      expect(contrast(p.text, p.soft), "text on soft").toBeGreaterThanOrEqual(5.5);
      expect(contrast(p.brand, p.soft), "brand on soft").toBeGreaterThanOrEqual(5.5);
      expect(contrast(p.ink, p.bg), "ink on page").toBeGreaterThanOrEqual(12);
      expect(contrast(p.muted, p.bg), "muted on page").toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.muted, "#ffffff"), "muted on white").toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.on, p.brand), "icon on brand").toBeGreaterThanOrEqual(4.5);
      for (const v of Object.values(p)) expect(v).toMatch(/^#[0-9a-f]{6}$/);
    });
  }

  it("knows the names and nothing else", () => {
    expect(isThemeName("blue")).toBe(true);
    expect(isThemeName("pink")).toBe(false);
    expect(isThemeName(null)).toBe(false);
  });

  describe("style", () => {
    afterEach(() => { delete process.env.SHOP_COLORS_ENABLED; });
    it("is empty while the feature is off, for the default green, and for unknown values", () => {
      expect(themeStyle("blue")).toBeUndefined();
      process.env.SHOP_COLORS_ENABLED = "true";
      expect(themeStyle("green")).toBeUndefined();
      expect(themeStyle(null)).toBeUndefined();
      expect(themeStyle("not-a-colour")).toBeUndefined();
    });
    it("sets the variables for a chosen colour", () => {
      process.env.SHOP_COLORS_ENABLED = "true";
      const s = themeStyle("blue")!;
      expect(Object.keys(s)).toEqual(["--brand", "--brand-hover", "--brand-soft", "--brand-softer", "--brand-border", "--brand-text", "--brand-ring", "--brand-on", "--brand-ink", "--brand-muted", "--brand-line", "--brand-bg"]);
      expect(s["--brand"]).toBe(paletteFor("blue").brand);
    });
  });
});
