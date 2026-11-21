import { describe, expect, it } from "vitest";
import { makeT } from "../core";
import { TH } from "../th";

const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");

describe("i18n", () => {
  it("keeps placeholders consistent in every Thai entry", () => {
    for (const [en, th] of Object.entries(TH)) expect(ph(th), en).toBe(ph(en));
  });
  it("English returns the key with params filled", () => {
    expect(makeT("en")("Hello {n}", { n: 3 })).toBe("Hello 3");
  });
  it("falls back to English when missing", () => {
    expect(makeT("th")("Not in dictionary zzz")).toBe("Not in dictionary zzz");
  });
  it("translates known keys to Thai", () => {
    const k = Object.keys(TH)[0];
    expect(makeT("th")(k)).toBe(TH[k]);
  });
});
