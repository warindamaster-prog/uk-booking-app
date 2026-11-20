import { z } from "zod";
import { escapeHtml } from "./notifications/templates";

export const SUPPORT_TOPICS = {
  billing: "Billing and subscription",
  booking: "Bookings or my booking page",
  payments: "Deposits and Stripe",
  emails: "Emails to my customers",
  account: "My account or login",
  other: "Something else",
} as const;
export type SupportTopic = keyof typeof SUPPORT_TOPICS;

export const supportSchema = z.object({
  topic: z.enum(Object.keys(SUPPORT_TOPICS) as [SupportTopic, ...SupportTopic[]], "Choose a topic"),
  message: z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(3000, "Use 3,000 characters or fewer"),
  replyTo: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address").max(254)),
});

export type SupportContext = {
  shopName: string; shopSlug: string; businessId: string; userEmail: string; role: string;
  billingStatus: string | null; replyTo: string; topic: SupportTopic; message: string;
};

/** The email our team receives. Everything needed to help is in it, so we never have to ask "which shop?". */
export function renderSupportEmail(c: SupportContext): { subject: string; text: string; html: string } {
  const rows: [string, string][] = [
    ["Shop", c.shopName], ["Booking page", `/b/${c.shopSlug}`], ["Shop id", c.businessId],
    ["Logged in as", `${c.userEmail} (${c.role})`], ["Plan status", c.billingStatus ?? "n/a"], ["Reply to", c.replyTo],
  ];
  const text = [`Topic: ${SUPPORT_TOPICS[c.topic]}`, "", c.message, "", "---", ...rows.map(([k, v]) => `${k}: ${v}`)].join("\n");
  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#171717;line-height:1.5;max-width:560px;margin:0 auto;padding:16px">
<h1 style="font-size:20px;margin:0 0 12px">Support: ${escapeHtml(SUPPORT_TOPICS[c.topic])}</h1>
<p style="white-space:pre-wrap;border-left:3px solid #d4d4d4;padding-left:12px">${escapeHtml(c.message)}</p>
<table style="border-collapse:collapse;font-size:14px">${rows.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#525252;white-space:nowrap">${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`).join("")}</table>
</body></html>`;
  return { subject: `[Support] ${c.shopName}: ${SUPPORT_TOPICS[c.topic]}`, text, html };
}

/** Where support messages go: SUPPORT_EMAIL if set, otherwise our own platform mailbox. */
export function supportInbox(env: NodeJS.ProcessEnv, fallback: string): string {
  return env.SUPPORT_EMAIL?.trim() || fallback;
}
