import { escapeHtml } from "./notifications/templates";

/** The two emails about the free trial. Plain text and simple HTML, same look as the account emails. */
type Mail = { subject: string; text: string; html: string };

const wrap = (heading: string, paragraphs: string[], link: { href: string; label: string } | null): string =>
  `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#171717;line-height:1.5;max-width:560px;margin:0 auto;padding:16px">
<h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(heading)}</h1>
${paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n")}
${link ? `<p><a href="${escapeHtml(link.href)}" style="display:inline-block;background:#171717;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none">${escapeHtml(link.label)}</a></p>` : ""}
</body></html>`;

/** About a week before the trial ends ("reminder") and again the day before ("final"). A shop that has already saved a card is told it will be charged. */
export function renderTrialReminderEmail(p: { shopName: string; endsOn: string; hasCard: boolean; billingUrl: string; supportEmail: string; final?: boolean }): Mail {
  const when = p.final ? "tomorrow" : `on ${p.endsOn}`;
  const lines = p.hasCard
    ? [
        `Your free trial for ${p.shopName} ends ${when}${p.final ? ` (${p.endsOn})` : ""}.`,
        p.final
          ? "You have saved a card, so your subscription starts then and the first payment is taken on that day. Nothing has been charged before it."
          : "You have saved a card, so your subscription starts then and the first payment is taken on that day. Nothing is charged before it.",
        "You can check or change your plan, or cancel, in Billing before then.",
      ]
    : [
        `Your free trial for ${p.shopName} ends ${when}${p.final ? ` (${p.endsOn})` : ""}.`,
        "After that your online booking page closes: customers will not be able to book. You can still log in and see your bookings.",
        `To keep your booking page open, contact us at ${p.supportEmail}. Nothing is charged for the trial.`,
      ];
  const heading = p.final ? "Your free trial ends tomorrow" : "Your free trial ends soon";
  return {
    subject: p.final ? "Your free trial ends tomorrow" : `Your free trial ends on ${p.endsOn}`,
    text: [...lines, "", `Billing: ${p.billingUrl}`].join("\n"),
    html: wrap(heading, lines, { href: p.billingUrl, label: "Open Billing" }),
  };
}

/** The day after the trial ended, for a shop that did not subscribe. */
export function renderTrialEndedEmail(p: { shopName: string; billingUrl: string; supportEmail: string }): Mail {
  const lines = [
    `The free trial for ${p.shopName} has ended, so your online booking page is closed and customers can't book at the moment.`,
    "You can still log in and see all your bookings and customers. Nothing has been deleted.",
    `To use the production version and open your booking page again, please contact us at ${p.supportEmail}.`,
  ];
  return {
    subject: "Your free trial has ended",
    text: [...lines, "", `Billing: ${p.billingUrl}`].join("\n"),
    html: wrap("Your free trial has ended", lines, { href: p.billingUrl, label: "Open Billing" }),
  };
}

export const TRIAL_REMINDER_DAYS = 7;

export type TrialRow = { status: string; trial_ends_at: string; created_at: string; stripe_subscription_id: string | null; trial_reminder_sent_at: string | null; trial_ended_email_sent_at: string | null };

/**
 * Which trial email (if any) a shop is due. Pure, so it can be tested without a database.
 * - "reminder": still trialing, the trial ends within a week, not told yet.
 * - "final": the trial ends within a day and the only reminder so far went out earlier than that
 *   (trial_reminder_sent_at holds the time of the LAST reminder, so no extra column is needed).
 * - "ended": the trial is over, the shop never subscribed, not told yet.
 * Shops whose trial was cut short on purpose (test mode ends it at sign-up) are skipped.
 */
export function trialEmailDue(r: TrialRow, now: Date): "reminder" | "final" | "ended" | null {
  if (r.status !== "trialing") return null;
  const ends = new Date(r.trial_ends_at).getTime();
  if (ends - new Date(r.created_at).getTime() < 86_400_000) return null;
  if (ends <= now.getTime()) return !r.stripe_subscription_id && !r.trial_ended_email_sent_at ? "ended" : null;
  const left = ends - now.getTime();
  if (left <= TRIAL_REMINDER_DAYS * 86_400_000 && !r.trial_reminder_sent_at) return "reminder";
  if (left <= 86_400_000 && r.trial_reminder_sent_at && new Date(r.trial_reminder_sent_at).getTime() < ends - 86_400_000) return "final";
  return null;
}
