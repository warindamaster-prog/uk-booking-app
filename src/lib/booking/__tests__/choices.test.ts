import { describe, expect, it } from "vitest";
import { buildChoices, parseChoice, priceFor, pricesVary, selectStaff, type StaffInfo } from "../choices";

const L1 = "00000000-0000-4000-8000-0000000000a1";
const L2 = "00000000-0000-4000-8000-0000000000a2";
const person = (id: string, name: string, level: string | null, level_name: string | null, price: number): StaffInfo =>
  ({ id, name, level_id: level, level_name, description: null, price_pence: price });

describe("shops without levels", () => {
  const staff = [person("a", "Amy", null, null, 3000), person("b", "Bea", null, null, 3000)];
  it("offers the simple 'Anyone' option and no price differences", () => {
    const c = buildChoices(staff);
    expect(c.grouped).toBe(false);
    expect(c.groups.map((g) => g.value)).toEqual(["any"]);
    expect(c.defaultValue).toBe("any");
    expect(c.people.map((p) => p.label)).toEqual(["Amy", "Bea"]);
  });
  it("a single person has no 'Anyone' option", () => {
    expect(buildChoices([staff[0]]).groups).toEqual([]);
  });
});

describe("levels that do not change the price of this service", () => {
  it("stays simple, but still shows each person's level", () => {
    const staff = [person("a", "Amy", L1, "Junior", 3000), person("b", "Bea", L2, "Senior", 3000)];
    const c = buildChoices(staff);
    expect(c.grouped).toBe(false);
    expect(c.people.map((p) => p.label)).toEqual(["Amy (Junior)", "Bea (Senior)"]);
  });
});

describe("levels with different prices", () => {
  const staff = [
    person("a", "Amy", L1, "Junior", 2500), person("b", "Bea", L2, "Senior", 4000),
    person("c", "Cat", L2, "Senior", 4000), person("d", "Dee", null, null, 3000),
  ];
  const c = buildChoices(staff);
  it("replaces 'Anyone' with one option per level, cheapest first", () => {
    expect(c.grouped).toBe(true);
    expect(c.groups.map((g) => [g.label, g.price_pence])).toEqual([["Any Junior", 2500], ["Any standard", 3000], ["Any Senior", 4000]]);
    expect(c.groups.find((g) => g.label === "Any Senior")!.staffIds).toEqual(["b", "c"]);
    expect(c.defaultValue).toBe(`level:${L1}`);
    expect(c.groups.map((g) => g.value)).not.toContain("any");
  });
  it("every option has one known price", () => {
    for (const g of c.groups) expect(priceFor(selectStaff(staff, parseChoice(g.value)))).toBe(g.price_pence);
    for (const p of c.people) expect(priceFor(selectStaff(staff, parseChoice(p.value)))).toBe(p.price_pence);
  });
  it("'any' mixes prices, so it has no single price", () => {
    expect(pricesVary(staff)).toBe(true);
    expect(priceFor(selectStaff(staff, parseChoice("any")))).toBeNull();
  });
});

describe("parseChoice and selectStaff", () => {
  const staff = [person("a", "Amy", L1, "Junior", 1), person("b", "Bea", null, null, 1)];
  it("parses every form", () => {
    expect(parseChoice("any")).toEqual({ type: "any" });
    expect(parseChoice("level:none")).toEqual({ type: "level", id: null });
    expect(parseChoice(`level:${L1}`)).toEqual({ type: "level", id: L1 });
    expect(parseChoice("a")).toEqual({ type: "staff", id: "a" });
  });
  it("selects by level, by 'no level', by person", () => {
    expect(selectStaff(staff, parseChoice(`level:${L1}`)).map((s) => s.id)).toEqual(["a"]);
    expect(selectStaff(staff, parseChoice("level:none")).map((s) => s.id)).toEqual(["b"]);
    expect(selectStaff(staff, parseChoice("b")).map((s) => s.id)).toEqual(["b"]);
    expect(selectStaff(staff, parseChoice("zzz"))).toEqual([]);
  });
});
