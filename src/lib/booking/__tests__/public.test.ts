import { describe, expect, it } from "vitest";
import { blockedInterval, candidateStaff, isLive } from "../slots";
import { byteaParam, clientIp, hashToken, limiterKey, newCancelToken, TOKEN_RE } from "../token";
import { bookingInputSchema, bookPageParams } from "../../validation/booking";
import { formatDateTime, formatTime, formatYmd } from "../../time";

const ID = "00000000-0000-4000-8000-000000000001";
const valid = {
  slug: "lily-nails", serviceId: ID, staff: "any", startsAt: "2027-03-02T10:00:00Z",
  name: "Cat", email: "Cat@Example.com", phone: "07700 900123", marketingConsent: false, website: "",
};

describe("cancel tokens", () => {
  it("are 43 url-safe chars, unique, and stored only as a hash", () => {
    const a = newCancelToken(), b = newCancelToken();
    expect(a.raw).toMatch(TOKEN_RE);
    expect(a.raw).not.toBe(b.raw);
    expect(a.hashHex).toBe(hashToken(a.raw));
    expect(a.hashHex).toMatch(/^[0-9a-f]{64}$/);
    expect(a.hashHex).not.toContain(a.raw);
    expect(byteaParam("ab")).toBe("\\xab");
  });
  it("limiter keys don't contain the raw value and depend on the secret", () => {
    const k = limiterKey("ip", "203.0.113.9", "s1");
    expect(k).toMatch(/^ip:[0-9a-f]{32}$/);
    expect(k).not.toContain("203");
    expect(limiterKey("ip", "203.0.113.9", "s2")).not.toBe(k);
  });
  it("reads the client IP from proxy headers", () => {
    const h = (m: Record<string, string>) => (n: string) => m[n] ?? null;
    expect(clientIp(h({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(clientIp(h({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(clientIp(h({}))).toBe("unknown");
  });
});

describe("live bookings", () => {
  const now = new Date("2027-03-01T12:00:00Z");
  it("counts confirmed, completed, no-show and unexpired holds only", () => {
    expect(isLive({ status: "confirmed", hold_expires_at: null }, now)).toBe(true);
    expect(isLive({ status: "no_show", hold_expires_at: null }, now)).toBe(true);
    expect(isLive({ status: "cancelled", hold_expires_at: null }, now)).toBe(false);
    expect(isLive({ status: "expired", hold_expires_at: null }, now)).toBe(false);
    expect(isLive({ status: "pending_payment", hold_expires_at: "2027-03-01T12:10:00Z" }, now)).toBe(true);
    expect(isLive({ status: "pending_payment", hold_expires_at: "2027-03-01T11:59:00Z" }, now)).toBe(false);
    expect(isLive({ status: "pending_payment", hold_expires_at: null }, now)).toBe(false);
  });
  it("blocked range includes both buffers", () => {
    const r = blockedInterval({ staff_id: "a", starts_at: "2027-03-02T10:00:00Z", ends_at: "2027-03-02T11:00:00Z",
      buffer_before_minutes: 5, buffer_after_minutes: 10, status: "confirmed", hold_expires_at: null });
    expect(r.start.toISOString()).toBe("2027-03-02T09:55:00.000Z");
    expect(r.end.toISOString()).toBe("2027-03-02T11:10:00.000Z");
  });
});

describe("candidateStaff", () => {
  const slot = { start: new Date(), end: new Date(), staffIds: ["b", "a"] };
  it("tries everyone for 'any', in the slot's order", () => expect(candidateStaff(slot, "any")).toEqual(["b", "a"]));
  it("only the chosen person if they are free", () => {
    expect(candidateStaff(slot, "a")).toEqual(["a"]);
    expect(candidateStaff(slot, "c")).toEqual([]);
  });
  it("nothing when the slot isn't offered", () => expect(candidateStaff(undefined, "any")).toEqual([]));
});

describe("bookingInputSchema", () => {
  it("normalises email and accepts a valid booking", () => {
    expect(bookingInputSchema.parse(valid).email).toBe("cat@example.com");
  });
  it.each([
    ["bad phone", { phone: "abc" }], ["bad email", { email: "nope" }], ["empty name", { name: " " }],
    ["honeypot filled", { website: "http://spam" }], ["non-UTC time", { startsAt: "2027-03-02T10:00:00+01:00" }],
    ["bad staff", { staff: "someone" }], ["bad slug", { slug: "A B" }],
  ])("rejects %s", (_n, over) => {
    expect(bookingInputSchema.safeParse({ ...valid, ...over }).success).toBe(false);
  });
});

describe("bookPageParams", () => {
  it("falls back safely on junk input", () => {
    expect(bookPageParams.parse({ staff: "zzz", date: "tomorrow", time: "x" })).toEqual({ staff: "any", date: undefined, time: undefined });
    expect(bookPageParams.parse({})).toEqual({ staff: "any" });
  });
});

describe("display formatting uses the business time zone", () => {
  it("shows BST and GMT correctly", () => {
    expect(formatTime("2026-07-01T09:00:00Z")).toBe("10:00");
    expect(formatTime("2026-01-10T10:00:00Z")).toBe("10:00");
    expect(formatYmd("2026-06-02")).toBe("Tue 2 Jun");
    expect(formatDateTime("2026-06-02T08:00:00Z")).toBe("Tue, 2 Jun 2026, 09:00");
  });
});

import { bookFirstAvailable, type CreateBookingRpc } from "../book";
import type { AvailabilityQuery } from "../../availability";

describe("bookFirstAvailable", () => {
  const input = { slug: "lily", serviceId: ID, staff: "any" as string, startsAt: "2027-03-02T10:00:00.000Z",
    name: "Cat", email: "cat@x.com", phone: "07700 900123", marketingConsent: false, website: "" };
  const hrs = (id: string) => ({ id, workingHours: [{ weekday: 2, start: 540, end: 1020 }], timeOff: [], blocked: [] });
  const base = (ids: string[]): Omit<AvailabilityQuery, "date"> => ({
    tz: "Europe/London", now: new Date("2027-01-01T00:00:00Z"), slotIntervalMinutes: 30, minNoticeMinutes: 0, maxAdvanceDays: 365,
    service: { durationMinutes: 60, bufferBeforeMinutes: 0, bufferAfterMinutes: 0 }, staff: ids.map(hrs),
  }); // 2027-03-02 is a Tuesday (GMT), so 10:00Z is 10:00 local
  const business = { id: "biz", timezone: "Europe/London", stripe_charges_enabled: false };
  let counter = 0;
  const newToken = () => ({ raw: `raw${counter}`, hashHex: `hash${counter++}` });
  const run = (rpc: CreateBookingRpc, over: Partial<Parameters<typeof bookFirstAvailable>[1]> = {}) =>
    bookFirstAvailable({ rpc, newToken }, { business, base: base(["a", "b"]), depositPence: 0, input, ...over });

  it("books the first candidate and passes the hashed token, never the raw one", async () => {
    const calls: Record<string, unknown>[] = [];
    const r = await run(async (a) => { calls.push(a); return { error: null }; });
    expect(r).toMatchObject({ ok: true, staffId: "a" });
    expect(calls).toHaveLength(1);
    expect(calls[0].p_cancel_token_hash).toMatch(/^\\x/);
    expect(JSON.stringify(calls[0])).not.toContain("raw");
    expect(calls[0].p_require_deposit).toBe(false);
  });
  it("falls back to the next staff member when the first is taken (23P01)", async () => {
    let n = 0;
    const r = await run(async () => (n++ === 0 ? { error: { code: "23P01" } } : { error: null }));
    expect(r).toMatchObject({ ok: true, staffId: "b" });
  });
  it("reports slot_taken when everyone is taken, and stops on other errors", async () => {
    expect(await run(async () => ({ error: { code: "23P01" } }))).toEqual({ ok: false, reason: "slot_taken" });
    let calls = 0;
    expect(await run(async () => { calls++; return { error: { code: "XX000" } }; })).toEqual({ ok: false, reason: "error" });
    expect(calls).toBe(1);
  });
  it("only tries the chosen person, and refuses a slot the engine does not offer", async () => {
    const seen: unknown[] = [];
    await run(async (a) => { seen.push(a.p_staff_id); return { error: { code: "23P01" } }; }, { input: { ...input, staff: "b" } });
    expect(seen).toEqual(["b"]);
    const never: CreateBookingRpc = async () => { throw new Error("must not be called"); };
    expect(await run(never, { input: { ...input, startsAt: "2027-03-02T03:00:00.000Z" } })).toEqual({ ok: false, reason: "slot_taken" });
  });
  it("blocks deposit services until Stripe is connected, then requires the deposit", async () => {
    const never: CreateBookingRpc = async () => { throw new Error("must not be called"); };
    expect(await run(never, { depositPence: 1000 })).toEqual({ ok: false, reason: "deposit_unavailable" });
    const args: Record<string, unknown>[] = [];
    await run(async (a) => { args.push(a); return { error: null }; }, { depositPence: 1000, business: { ...business, stripe_charges_enabled: true } });
    expect(args[0].p_require_deposit).toBe(true);
  });
});
