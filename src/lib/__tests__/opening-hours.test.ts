import { describe, expect, it } from "vitest";
import { groupedOpeningTimes, openingTimes, openingTimesFromOwn, rangesText } from "../opening-hours";

const row = (weekday: number, s: number, e: number) => ({ weekday, start_minute: s, end_minute: e });

describe("opening times", () => {
  it("merges overlapping hours of different people and keeps gaps", () => {
    const days = openingTimes([row(1, 480, 720), row(1, 600, 840), row(1, 900, 1020)]);
    expect(days[0].ranges).toEqual([{ start: 480, end: 840 }, { start: 900, end: 1020 }]);
    expect(rangesText(days[0].ranges)).toBe("08:00 – 14:00, 15:00 – 17:00");
  });
  it("shows days with no hours as closed", () => {
    expect(rangesText(openingTimes([])[2].ranges)).toBe("Closed");
  });
  it("groups consecutive days with the same hours", () => {
    const rows = [1, 2, 3, 4, 5].map((d) => row(d, 540, 1020)).concat([row(6, 600, 780)]);
    expect(groupedOpeningTimes(openingTimes(rows))).toEqual([
      { label: "Monday – Friday", text: "09:00 – 17:00" },
      { label: "Saturday", text: "10:00 – 13:00" },
      { label: "Sunday", text: "Closed" },
    ]);
  });
  it("does not join separate runs with the same hours", () => {
    const rows = [1, 3].map((d) => row(d, 540, 1020));
    const g = groupedOpeningTimes(openingTimes(rows));
    expect(g.map((x) => x.label)).toEqual(["Monday", "Tuesday", "Wednesday", "Thursday – Sunday"]);
  });
  it("reads the hours a shop typed in and ignores malformed entries", () => {
    const days = openingTimesFromOwn([{ weekday: 2, start: 540, end: 1020 }, { weekday: 9, start: 1, end: 2 }, { weekday: 3, start: 700, end: 600 }, "x"]);
    expect(rangesText(days[1].ranges)).toBe("09:00 – 17:00");
    expect(days.filter((d) => d.ranges.length)).toHaveLength(1);
    expect(openingTimesFromOwn(null).every((d) => d.ranges.length === 0)).toBe(true);
  });
});
