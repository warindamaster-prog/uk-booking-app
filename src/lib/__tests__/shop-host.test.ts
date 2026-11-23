import { describe, expect, it } from "vitest";
import { routeShopHost, shopDisplayAddress, shopUrl } from "../shop-host";
import { RESERVED_SLUGS } from "../slug";

const siteUrl = "https://getitbook.com";
const r = (host: string, path: string, search = "", enabled = true) => routeShopHost({ host, path, search, siteUrl, enabled });

describe("shop addresses", () => {
  it("uses the sub-domain when switched on, the /b/ path when off", () => {
    expect(shopUrl({ siteUrl, slug: "klean-me", enabled: true })).toBe("https://klean-me.getitbook.com");
    expect(shopUrl({ siteUrl, slug: "klean-me", path: "/booking/abc", enabled: true })).toBe("https://klean-me.getitbook.com/booking/abc");
    expect(shopUrl({ siteUrl, slug: "klean-me", enabled: false })).toBe("https://getitbook.com/b/klean-me");
    expect(shopUrl({ siteUrl, slug: "klean-me", path: "/booking/abc", enabled: false })).toBe("https://getitbook.com/b/klean-me/booking/abc");
    expect(shopDisplayAddress({ siteUrl, slug: "wp-consulting", enabled: true })).toBe("wp-consulting.getitbook.com");
  });
});

describe("routing by host", () => {
  it("does nothing while switched off", () => {
    expect(r("klean-me.getitbook.com", "/", "", false)).toEqual({ kind: "none" });
    expect(r("getitbook.com", "/b/klean-me", "", false)).toEqual({ kind: "none" });
  });

  it("shows a shop on its sub-domain by rewriting onto /b/<shop>", () => {
    expect(r("klean-me.getitbook.com", "/")).toEqual({ kind: "rewrite", slug: "klean-me", path: "/b/klean-me" });
    expect(r("klean-me.getitbook.com", "/services")).toEqual({ kind: "rewrite", slug: "klean-me", path: "/b/klean-me/services" });
    expect(r("klean-me.getitbook.com", "/book/abc")).toEqual({ kind: "rewrite", slug: "klean-me", path: "/b/klean-me/book/abc" });
    expect(r("klean-me.getitbook.com", "/booking/tok")).toEqual({ kind: "rewrite", slug: "klean-me", path: "/b/klean-me/booking/tok" });
    expect(r("KLEAN-ME.getitbook.com:443", "/")).toMatchObject({ kind: "rewrite", slug: "klean-me" });
  });

  it("sends an old /b/<shop> address on to the sub-domain, keeping the rest and the query", () => {
    expect(r("getitbook.com", "/b/klean-me")).toEqual({ kind: "redirect", url: "https://klean-me.getitbook.com" });
    expect(r("getitbook.com", "/b/klean-me/booking/tok", "?paid=1")).toEqual({ kind: "redirect", url: "https://klean-me.getitbook.com/booking/tok?paid=1" });
    expect(r("www.getitbook.com", "/b/klean-me/book/s1")).toEqual({ kind: "redirect", url: "https://klean-me.getitbook.com/book/s1" });
  });

  it("cleans a /b/<this shop> address on the shop's own sub-domain", () => {
    expect(r("klean-me.getitbook.com", "/b/klean-me/book/abc", "?staff=any")).toEqual({ kind: "redirect", url: "https://klean-me.getitbook.com/book/abc?staff=any" });
  });

  it("sends account pages on a shop's sub-domain to the main site", () => {
    expect(r("klean-me.getitbook.com", "/login")).toEqual({ kind: "redirect", url: "https://getitbook.com/login" });
    expect(r("klean-me.getitbook.com", "/dashboard/billing", "?x=1")).toEqual({ kind: "redirect", url: "https://getitbook.com/dashboard/billing?x=1" });
  });

  it("leaves the main site, other hosts, reserved names and unknown paths alone", () => {
    expect(r("getitbook.com", "/")).toEqual({ kind: "none" });
    expect(r("getitbook.com", "/login")).toEqual({ kind: "none" });
    expect(r("uk-booking-app-x.vercel.app", "/b/klean-me")).toEqual({ kind: "none" });
    expect(r("book.wpprecisionsystems.co.uk", "/b/klean-me")).toEqual({ kind: "none" });
    expect(r("localhost:3000", "/")).toEqual({ kind: "none" });
    expect(r("app.getitbook.com", "/")).toEqual({ kind: "none" });
    expect(r("a.b.getitbook.com", "/")).toEqual({ kind: "none" });
    expect(r("klean-me.getitbook.com", "/privacy")).toEqual({ kind: "none" });
    expect(r("getitbook.com", "/b/www/book/x")).toEqual({ kind: "none" });
  });

  it("reserves the names we want for ourselves", () => {
    for (const n of ["www", "app", "api", "mail", "support", "status", "admin", "login", "dashboard"]) expect(RESERVED_SLUGS.has(n), n).toBe(true);
  });
});
