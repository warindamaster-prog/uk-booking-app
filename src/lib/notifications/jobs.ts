import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isReminderDue } from "./due";
import type { EmailProvider } from "./provider";
import { MAX_ATTEMPTS, sendNotification, type NotifyConfig } from "./send";
import type { EmailKind, Recipient } from "./templates";

type Db = ReturnType<typeof createAdminClient>;
export type JobCounts = { expiredHolds: number; remindersSent: number; retried: number; gaveUp: number };

/** Run every few minutes: releases expired unpaid holds, sends due reminders, retries failed emails. */
export async function runNotificationJobs(db: Db, provider: EmailProvider, cfg: NotifyConfig, now: Date = new Date()): Promise<JobCounts> {
  const counts: JobCounts = { expiredHolds: 0, remindersSent: 0, retried: 0, gaveUp: 0 };

  // 1. Unpaid holds whose time ran out stop blocking the calendar.
  const expired = await db.from("bookings").update({ status: "expired" }, { count: "exact" })
    .eq("status", "pending_payment").lt("hold_expires_at", now.toISOString());
  counts.expiredHolds = expired.count ?? 0;

  // 2. Reminders: confirmed bookings starting within the next 24 hours that haven't had one.
  const horizon = new Date(now.getTime() + 24 * 3_600_000).toISOString();
  const { data: candidates } = await db.from("bookings")
    .select("id, status, starts_at, created_at, reminder_sent_at")
    .eq("status", "confirmed").is("reminder_sent_at", null)
    .gt("starts_at", now.toISOString()).lte("starts_at", horizon).limit(200);
  for (const b of candidates ?? []) {
    if (!isReminderDue(b, now)) continue;
    const outcome = await sendNotification(db, provider, cfg, { bookingId: b.id, kind: "reminder", recipient: "customer" });
    if (outcome === "sent" || outcome === "skipped" || outcome === "gave_up") {
      await db.from("bookings").update({ reminder_sent_at: now.toISOString() }).eq("id", b.id).is("reminder_sent_at", null);
      if (outcome === "sent") counts.remindersSent++;
      if (outcome === "gave_up") counts.gaveUp++;
    } // "failed": leave it, the next run tries again (up to MAX_ATTEMPTS)
  }

  // 3. Retry confirmations, cancellations and reschedule notices that failed or never finished.
  const since = new Date(now.getTime() - 3 * 24 * 3_600_000).toISOString();
  const { data: stuck } = await db.from("booking_notifications")
    .select("id, booking_id, kind, recipient, seq, attempts")
    .in("status", ["pending", "failed"]).neq("kind", "reminder").lt("attempts", MAX_ATTEMPTS)
    .gt("created_at", since).limit(100);
  for (const n of stuck ?? []) {
    const { data: b } = await db.from("bookings").select("ics_sequence").eq("id", n.booking_id).maybeSingle();
    if (!b || b.ics_sequence !== n.seq) { // the booking has changed since: this email is obsolete
      await db.from("booking_notifications").update({ attempts: MAX_ATTEMPTS, error: "superseded" }).eq("id", n.id);
      continue;
    }
    const outcome = await sendNotification(db, provider, cfg, { bookingId: n.booking_id, kind: n.kind as EmailKind, recipient: n.recipient as Recipient });
    if (outcome === "sent") counts.retried++;
    if (outcome === "gave_up") counts.gaveUp++;
  }
  return counts;
}
