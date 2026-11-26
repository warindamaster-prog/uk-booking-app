import { describe, expect, it } from "vitest";
import { parsePromoCodes, trialDaysForCode } from "../promo-codes";

const setting = "EMCHAMBER:90:2027-11-30:year, FRIEND:120 ,bad,X:0,TOOLONG:9999,BAD DATE:90:soon,ODD:90::weekly";
const now = new Date("2026-12-01T12:00:00Z");

describe("promotion codes for a longer trial", () => {
  it("reads codes with days and an optional last day, and ignores broken entries", () => {
    expect(parsePromoCodes(setting)).toEqual([
      { code: "EMCHAMBER", days: 90, lastDay: "2027-11-30", plan: "year" },
      { code: "FRIEND", days: 120, lastDay: null, plan: null },
    ]);
    expect(parsePromoCodes(undefined)).toEqual([]);
  });
  it("accepts a code in any case and returns its days", () => {
    expect(trialDaysForCode(" emchamber ", now, setting)).toEqual({ code: "EMCHAMBER", days: 90, plan: "year" });
    expect(trialDaysForCode("FRIEND", now, setting)).toEqual({ code: "FRIEND", days: 120, plan: null });
  });
  it("refuses unknown, empty and expired codes", () => {
    expect(trialDaysForCode("NOPE", now, setting)).toBeNull();
    expect(trialDaysForCode("", now, setting)).toBeNull();
    expect(trialDaysForCode("EMCHAMBER", new Date("2027-12-01T00:00:00Z"), setting)).toBeNull();
    expect(trialDaysForCode("EMCHAMBER", new Date("2027-11-30T23:00:00Z"), setting)).not.toBeNull(); // the last day still counts
  });
});
