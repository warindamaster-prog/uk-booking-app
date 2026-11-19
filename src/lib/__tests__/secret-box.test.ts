import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, parseKey } from "../secret-box";
import { isPrivateAddress, looksLikePublicHostname } from "../notifications/safe-host";

const key = randomBytes(32);

describe("secret box", () => {
  it("round-trips and never stores the plain text", () => {
    const box = encryptSecret("p@ss word £", key);
    expect(box).not.toContain("p@ss");
    expect(decryptSecret(box, key)).toBe("p@ss word £");
  });
  it("uses a fresh nonce each time", () => {
    expect(encryptSecret("a", key)).not.toBe(encryptSecret("a", key));
  });
  it("rejects the wrong key and tampering", () => {
    const box = encryptSecret("secret", key);
    expect(() => decryptSecret(box, randomBytes(32))).toThrow();
    const parts = box.split(".");
    parts[3] = Buffer.from("x".repeat(8)).toString("base64url");
    expect(() => decryptSecret(parts.join("."), key)).toThrow();
    expect(() => decryptSecret("garbage", key)).toThrow();
  });
  it("requires a 32-byte key", () => {
    expect(() => parseKey(undefined)).toThrow();
    expect(() => parseKey("short")).toThrow();
    expect(parseKey(key.toString("base64url"))).toHaveLength(32);
  });
});

describe("mail server safety", () => {
  it("blocks internal addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.1.1", "172.16.0.5", "169.254.169.254", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1", "100.64.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "172.32.0.1", "2607:f8b0:4004::1"]) expect(isPrivateAddress(ip), ip).toBe(false);
  });
  it("accepts only public hostnames", () => {
    expect(looksLikePublicHostname("smtp.gmail.com")).toBe(true);
    expect(looksLikePublicHostname("mail.privateemail.com")).toBe(true);
    for (const h of ["localhost", "127.0.0.1", "intranet", "db.internal", "a b.com", "smtp.gmail.com:25", ""]) {
      expect(looksLikePublicHostname(h), h).toBe(false);
    }
  });
});

import { emailSettingsSchema } from "../validation/email-settings";

describe("email settings form", () => {
  const ok = { host: "SMTP.Gmail.com ", port: "587", user: " Shop@Gmail.com ", pass: "x", fromName: "  " };
  it("normalises valid input", () => {
    expect(emailSettingsSchema.parse(ok)).toEqual({ host: "smtp.gmail.com", port: 587, user: "shop@gmail.com", pass: "x", fromName: null });
  });
  it("rejects internal hosts, odd ports and bad addresses", () => {
    expect(emailSettingsSchema.safeParse({ ...ok, host: "localhost" }).success).toBe(false);
    expect(emailSettingsSchema.safeParse({ ...ok, host: "10.0.0.1" }).success).toBe(false);
    expect(emailSettingsSchema.safeParse({ ...ok, port: "25" }).success).toBe(false);
    expect(emailSettingsSchema.safeParse({ ...ok, user: "not-an-email" }).success).toBe(false);
  });
});
