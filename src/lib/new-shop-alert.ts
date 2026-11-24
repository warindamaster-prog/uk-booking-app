import "server-only";
import { createMailers } from "./notifications/resend";
import { shopDisplayAddress } from "./shop-host";

export type NewShop = { name: string; slug: string; ownerName: string; email: string; phone: string; seats: number; interval: string };

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The alert for us when a new shop signs up. Pure, so it can be tested. */
export function newShopEmail(s: NewShop, siteUrl: string): { subject: string; text: string; html: string } {
  const lines = [
    `Shop: ${s.name}`, `Address: ${shopDisplayAddress({ siteUrl, slug: s.slug })}`, `Owner: ${s.ownerName}`, `Email: ${s.email}`, `Phone: ${s.phone}`,
    `Plan: ${s.interval}, ${s.seats} ${s.seats === 1 ? "person" : "people"}`,
  ];
  return {
    subject: `New shop on Get It Book: ${s.name}`.replace(/[\r\n]+/g, " "),
    text: `A new shop has signed up.\n\n${lines.join("\n")}\n`,
    html: `<p>A new shop has signed up.</p><ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`,
  };
}

/** Emails us (NEW_SHOP_ALERT_TO, default the company contact address). Never throws: a failed alert must not break sign-up. */
export async function alertNewShop(s: NewShop): Promise<void> {
  try {
    const to = process.env.NEW_SHOP_ALERT_TO || "contact@wpprecisionsystems.co.uk";
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getitbook.com";
    const mailers = createMailers();
    await mailers.provider("business").send({
      from: `"Get It Book alerts" <${mailers.fromAddress("business")}>`,
      to,
      ...newShopEmail(s, site),
      idempotencyKey: `new-shop:${s.slug}`,
    });
  } catch (e) {
    console.error("new shop alert failed", e instanceof Error ? e.message : e);
  }
}
