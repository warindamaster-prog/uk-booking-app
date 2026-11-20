import { describe, expect, it } from "vitest";
import { renderConfirmEmail, renderExistingAccountEmail, renderResetEmail, TOKEN_HASH_RE } from "../auth-email";

describe("password reset email", () => {
  it("links to the confirm page and says what to do if it wasn't requested", () => {
    const r = renderResetEmail("https://x.test/reset-password/confirm?token_hash=abc123");
    expect(r.text).toContain("https://x.test/reset-password/confirm?token_hash=abc123");
    expect(r.text).toMatch(/ignore this email/);
    expect(r.html).toContain('href="https://x.test/reset-password/confirm?token_hash=abc123"');
    expect(r.subject).toBe("Reset your password");
  });
  it("escapes the link in the HTML", () => {
    expect(renderResetEmail('https://x.test/?a="><script>').html).not.toContain("<script>");
  });
  it("only accepts a plausible token", () => {
    expect(TOKEN_HASH_RE.test("a".repeat(56))).toBe(true);
    expect(TOKEN_HASH_RE.test("abc")).toBe(false);
    expect(TOKEN_HASH_RE.test("a".repeat(20) + "<script>")).toBe(false);
    expect(TOKEN_HASH_RE.test("a".repeat(20) + "/../")).toBe(false);
  });
});

describe("sign-up emails", () => {
  it("the confirmation email has a button to the confirm page and escapes the link", () => {
    const r = renderConfirmEmail("https://x.test/signup/confirm?token_hash=abc");
    expect(r.subject).toBe("Confirm your email address");
    expect(r.text).toContain("https://x.test/signup/confirm?token_hash=abc");
    expect(r.html).toContain('href="https://x.test/signup/confirm?token_hash=abc"');
    expect(renderConfirmEmail('https://x.test/?a="><script>').html).not.toContain("<script>");
  });
  it("the existing-account email points to log in and password reset, with nothing secret in it", () => {
    const r = renderExistingAccountEmail("https://x.test/login", "https://x.test/forgot-password");
    expect(r.text).toContain("https://x.test/login");
    expect(r.text).toContain("https://x.test/forgot-password");
    expect(r.text).not.toMatch(/token/i);
  });
});
