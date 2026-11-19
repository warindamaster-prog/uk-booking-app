import { describe, expect, it } from "vitest";
import { duplicateMessage, escapeLike, findDuplicate, normalizeName, normalizePhone, type KnownCustomer, type UpcomingBooking } from "../duplicates";

describe("normalizePhone", () => {
  it("treats every way of writing the same UK number as equal", () => {
    const same = ["07700 900123", "07700900123", "+44 7700 900123", "+44 (0)7700 900123", "0044 7700 900123", "447700900123", "(07700) 900-123"];
    expect(new Set(same.map(normalizePhone))).toEqual(new Set(["07700900123"]));
  });
  it("keeps different numbers different, and empty input empty", () => {
    expect(normalizePhone("07700 900124")).not.toBe(normalizePhone("07700 900123"));
    expect(normalizePhone("abc")).toBe("");
  });
});

describe("normalizeName and escapeLike", () => {
  it("ignores case, spacing and accents", () => {
    expect(normalizeName("  José   Müller ")).toBe("jose muller");
  });
  it("escapes LIKE wildcards so a name can only match itself", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
  });
});

describe("findDuplicate", () => {
  const customers: KnownCustomer[] = [
    { id: "c1", name: "Pat Smith", email: "pat@example.com", phone: "07700 900123" },
    { id: "c2", name: "Pat Smith", email: "other@example.com", phone: "07700 900999" },
    { id: "c3", name: "Sam Jones", email: null, phone: "+44 7700 900555" },
  ];
  const bookings: UpcomingBooking[] = [
    { customer_id: "c1", service_name: "Gel manicure", starts_at: "2026-12-05T10:00:00Z" },
    { customer_id: "c1", service_name: "Pedicure", starts_at: "2026-12-02T10:00:00Z" },
    { customer_id: "c2", service_name: "Cut", starts_at: "2026-12-01T10:00:00Z" },
    { customer_id: "c3", service_name: "Massage", starts_at: "2026-12-03T10:00:00Z" },
  ];
  const input = (over: Partial<{ name: string; phone: string; email: string }> = {}) => ({ name: "pat  SMITH", phone: "+44 7700 900123", email: "pat@example.com", ...over });

  it("finds the same name and number however they are written, and names the nearest booking's service", () => {
    expect(findDuplicate(input(), customers, bookings)).toEqual({ serviceName: "Pedicure", sameEmail: true });
  });
  it("does not reveal the service when the email is different", () => {
    expect(findDuplicate(input({ email: "someone.else@example.com" }), customers, bookings)).toEqual({ serviceName: null, sameEmail: false });
  });
  it("needs BOTH name and phone to match", () => {
    expect(findDuplicate(input({ phone: "07700 900000" }), customers, bookings)).toBeNull();
    expect(findDuplicate(input({ name: "Patricia Smith" }), customers, bookings)).toBeNull();
    expect(findDuplicate(input({ name: "Pat Smith", phone: "07700 900999" }), customers, bookings)?.sameEmail).toBe(false); // c2's number belongs to a different Pat
  });
  it("ignores customers with no upcoming booking, no phone, or an empty input phone", () => {
    expect(findDuplicate(input({ name: "Sam Jones", phone: "07700 900555", email: "x@y.z" }), customers, [])).toBeNull();
    expect(findDuplicate(input({ phone: "" }), customers, bookings)).toBeNull();
    expect(findDuplicate(input({ name: "Sam Jones", phone: "07700 900555" }), [{ id: "c3", name: "Sam Jones", email: null, phone: null }], bookings)).toBeNull();
  });
  it("words the confirmation question", () => {
    expect(duplicateMessage({ serviceName: "Pedicure", sameEmail: true }, "Lily Nails")).toContain("for Pedicure");
    expect(duplicateMessage({ serviceName: null, sameEmail: false }, "Lily Nails")).toBe("This name and phone number already have an upcoming booking with Lily Nails. Do you want to book another?");
  });
});
