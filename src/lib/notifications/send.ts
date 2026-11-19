import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { deriveCancelToken } from "@/lib/booking/token";
import type { Mailers } from "./provider";
import { buildIcs } from "./ics";
import { MAX_ATTEMPTS, safeDisplayName } from "./rules";
import { renderEmail, type EmailKind, type Recipient } from "./templates";

type Db = ReturnType<typeof createAdminClient>;

export type NotifyConfig = { siteUrl: string; tokenSecret: string };
export type SendOutcome = "sent" | "skipped" | "failed" | "gave_up";
export { MAX_ATTEMPTS };

const STATUS_OK: Record<EmailKind, string[]> = {
  confirmation: ["confirmed"],
  reminder: ["confirmed"],
  reschedule: ["confirmed", "pending_payment"],
  cancellation: ["cancelled"],
};

/**
 * Sends one email, once. A row in booking_notifications (unique per booking version, kind and
 * recipient) is created first; if it is already marked sent nothing happens, and the provider
 * is given an idempotency key as a second guard. Failures are recorded for the retry job.
 */
export async function sendNotification(
  db: Db, mail: Mailers, cfg: NotifyConfig,
  req: { bookingId: string; kind: EmailKind; recipient: Recipient },
): Promise<SendOutcome> {
  const { data: b } = await db.from("bookings").select("*").eq("id", req.bookingId).maybeSingle();
  if (!b || !STATUS_OK[req.kind].includes(b.status)) return "skipped"; // e.g. an unpaid hold, or already cancelled

  const [{ data: biz }, { data: cust }, { data: staff }] = await Promise.all([
    db.from("businesses").select("id, name, slug, timezone, email, phone, show_contact_to_customers, cancellation_window_hours").eq("id", b.business_id).single(),
    db.from("customers").select("name, email, phone").eq("id", b.customer_id).eq("business_id", b.business_id).single(),
    db.from("staff").select("name").eq("id", b.staff_id).eq("business_id", b.business_id).single(),
  ]);
  if (!biz || !cust) return "skipped";

  const to = req.recipient === "customer" ? cust.email : biz.email;
  if (!to) return "skipped"; // anonymised customer, or the business has no contact email

  const key = { business_id: b.business_id, booking_id: b.id, kind: req.kind, channel: "email", recipient: req.recipient, seq: b.ics_sequence };
  await db.from("booking_notifications").upsert(key, { onConflict: "booking_id,kind,channel,recipient,seq", ignoreDuplicates: true });
  const { data: row } = await db.from("booking_notifications").select("id, status, attempts")
    .eq("booking_id", b.id).eq("kind", req.kind).eq("channel", "email").eq("recipient", req.recipient).eq("seq", b.ics_sequence).single();
  if (!row || row.status === "sent") return "skipped";
  if (row.attempts >= MAX_ATTEMPTS) return "gave_up";

  const startsAt = new Date(b.starts_at), endsAt = new Date(b.ends_at);
  const manageUrl = `${cfg.siteUrl}/b/${biz.slug}/booking/${deriveCancelToken(cfg.tokenSecret, b.id).raw}`;
  const deadline = new Date(startsAt.getTime() - biz.cancellation_window_hours * 3_600_000);
  const rendered = renderEmail(req.kind, req.recipient, {
    businessName: biz.name, serviceName: b.service_name, staffName: staff?.name ?? "your practitioner",
    customerName: cust.name, customerEmail: cust.email, customerPhone: cust.phone,
    startsAt, endsAt, tz: biz.timezone, pricePence: b.price_pence, depositPence: b.deposit_pence, depositStatus: b.deposit_status,
    manageUrl, dashboardUrl: `${cfg.siteUrl}/dashboard/bookings/${b.id}`,
    cancelDeadline: b.status === "confirmed" && deadline > new Date() ? deadline : null,
    cancelledBy: b.cancelled_by,
    contact: biz.show_contact_to_customers ? { email: biz.email, phone: biz.phone } : null,
  });

  const wantsIcs = req.kind !== "reminder" && (req.recipient === "customer" || req.kind === "confirmation");
  const ics = wantsIcs ? buildIcs({
    uid: `booking-${b.id}@${new URL(cfg.siteUrl).hostname}`, sequence: b.ics_sequence,
    method: req.kind === "cancellation" ? "CANCEL" : "PUBLISH",
    start: startsAt, end: endsAt, summary: `${b.service_name} with ${biz.name}`,
    description: `Booked online. View or cancel: ${manageUrl}`, now: new Date(),
  }) : null;

  try {
    const sent = await mail.provider(req.recipient).send({
      from: `"${safeDisplayName(mail.fromName(req.recipient, biz.name))}" <${mail.fromAddress(req.recipient)}>`,
      to,
      replyTo: req.recipient === "customer" ? biz.email ?? undefined : cust.email ?? undefined,
      subject: rendered.subject, text: rendered.text, html: rendered.html,
      attachments: ics ? [{ filename: "booking.ics", content: ics, contentType: req.kind === "cancellation" ? "text/calendar; method=CANCEL" : "text/calendar; method=PUBLISH" }] : undefined,
      idempotencyKey: `${b.id}:${req.kind}:${req.recipient}:${b.ics_sequence}`,
    });
    await db.from("booking_notifications").update({ status: "sent", provider_id: sent.id, sent_at: new Date().toISOString(), attempts: row.attempts + 1, error: null }).eq("id", row.id);
    return "sent";
  } catch (e) {
    const message = (e instanceof Error ? e.message : String(e)).slice(0, 300);
    await db.from("booking_notifications").update({ status: "failed", error: message, attempts: row.attempts + 1 }).eq("id", row.id);
    return "failed";
  }
}

