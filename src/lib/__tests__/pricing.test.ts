import { describe, expect, it } from "vitest";
import { grossPence, pricePence, threeYearSavingVsMonthlyPence, threeYearSavingVsYearlyPence, vatPence } from "../pricing";

describe("3-year prepaid price", () => {
  it("is 35% off 36 months of the monthly price", () => {
    expect(pricePence(3, "three_year")).toBe(44460); // 19.00 x 36 = 684.00, x 0.65
    expect(pricePence(5, "three_year")).toBe(53820);
    expect(pricePence(10, "three_year")).toBe(77220);
  });
  it("adds VAT on top", () => {
    expect(vatPence(44460)).toBe(8892);
    expect(grossPence(44460)).toBe(53352);
  });
  it("is always a whole number of pence", () => {
    for (let s = 3; s <= 50; s++) expect(Number.isInteger(pricePence(s, "three_year"))).toBe(true);
  });
  it("shows the savings against monthly and yearly", () => {
    expect(threeYearSavingVsMonthlyPence(3)).toBe(68400 - 44460);
    expect(threeYearSavingVsYearlyPence(3)).toBe(57000 - 44460); // yearly 3 staff is £190, x 3 = £570
  });
  it("needs at least 3 staff and takes no SMS packs", () => {
    expect(() => pricePence(2, "three_year")).toThrow(/at least 3/);
    expect(() => pricePence(3, "three_year", 1)).toThrow(/SMS/);
  });
  it("leaves monthly and yearly prices alone", () => {
    expect(pricePence(3, "month")).toBe(1900);
    expect(pricePence(3, "year")).toBe(19000);
  });
});
