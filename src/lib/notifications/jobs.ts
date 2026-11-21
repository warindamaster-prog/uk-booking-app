import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isReminderDue, REMINDER_LEAD_MS } from "./due";
import type { Mailers } from "./provider";
import { settleDeposit } from "@/lib/stripe/service";
import { isStaleToRetry } from "./rules";
import { MAX_ATTEMPTS, sendNotification, type NotifyConfig } from "./send";
import { runPrepaidJobs } from "./prepaid-jobs";
import { runTrialEmails } from "./trial-jobs";
import type { EmailKind, Recipient } from "./templates";

type Db = ReturnType<typeof createAdminClient>;
export type JobCounts = { expiredHolds: number; remindersSent: number; retried: number; gaveUp: number; refundsRetried: number; reductionsApplied: number; trialEmailsSent: number; prepaidClosed: number; prepaidNoticesSent: number };

/** Run every few minutes: releases expired unpaid holds, sends due reminders, retries failed emails and refunds, applies plan reductions that have come due. */
export async function runNotificationJobs(db: Db, mail: Mailers, cfg: NotifyConfig, now: Date = new Date()): Promise<JobCounts> {
  const counts: JobCounts = { expiredHolds: 0, remindersSent: 0, retried: 0, gaveUp: 0, refundsRetried: 0, reductionsApplied: 0, trialEmailsSent: 0, prepaidClosed: 0, prepaidNoticesSent: 0 };

  // 1. Unpaid holds whose time ran out stop blocking the calendar.
  const expired = await db.from("bookings").update({ status: "expired" }, { count: "exact" })
    .eq("status", "pending_payment").lt("hold_expires_at", now.toISOString());
  counts.expiredHolds = expired.count ?? 0;

  // 2. Reminders: confirmed bookings starting within the next hour that haven't had one.
  const horizon = new Date(now.getTime() + REMINDER_LEAD_MS).toISOString();
  const { data: candidates } = await db.from("bookings")
    .select("id, status, starts_at, created_at, reminder_sent_at")
    .eq("status", "confirmed").is("reminder_sent_at", null)
    .gt("starts_at", now.toISOString()).lte("starts_at", horizon).limit(200);
  for (const b of candidates ?? []) {
    if (!isReminderDue(b, now)) continue;
    const outcome = await sendNotification(db, mail, cfg, { bookingId: b.id, kind: "reminder", recipient: "customer" });
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
    const { data: b } = await db.from("bookings").select("ics_sequence, starts_at").eq("id", n.booking_id).maybeSingle();
    if (!b || b.ics_sequence !== n.seq || isStaleToRetry(n.kind, b.starts_at, now)) { // the booking has changed or already started: this email is obsolete
      await db.from("booking_notifications").update({ attempts: MAX_ATTEMPTS, error: "superseded" }).eq("id", n.id);
      continue;
    }
    const outcome = await sendNotification(db, mail, cfg, { bookingId: n.booking_id, kind: n.kind as EmailKind, recipient: n.recipient as Recipient });
    if (outcome === "sent") counts.retried++;
    if (outcome === "gave_up") counts.gaveUp++;
  }

  // 4. Deposits still marked paid on a cancelled or expired booking are owed back: retry the refund.
  const { data: owed } = await db.from("bookings").select("id, cancelled_by")
    .in("status", ["cancelled", "expired"]).eq("deposit_status", "paid").limit(50);
  for (const b of owed ?? []) {
    const result = await settleDeposit(db, b.id, b.cancelled_by === "business" ? "business" : "customer");
    if (result === "refunded") counts.refundsRetried++;
  }

  // 5. Safety net for plan reductions (fewer people / SMS packs) planned for the end of the billing period.
  // Normally Stripe's renewal event applies them; if that event is late or lost, this does it. Safe to repeat.
  const due = await db.rpc("apply_due_seat_changes");
  if (due.error) console.error("apply_due_seat_changes failed", due.error.message);
  else counts.reductionsApplied = Number(due.data ?? 0);

  // 6. Free-trial emails (a week before the end, and once after it ended without a subscription). Never lets a problem here stop the jobs above.
  try { counts.trialEmailsSent = await runTrialEmails(db, mail, now); } catch (e) { console.error("trial emails failed", e instanceof Error ? e.message : e); }
  // 7. Prepaid 3-year plans: close the ones that ended, and send the 60 and 30 day notices (does nothing while the plan is switched off).
  try { const r = await runPrepaidJobs(db, mail, now); counts.prepaidClosed = r.closed; counts.prepaidNoticesSent = r.noticesSent; } catch (e) { console.error("prepaid jobs failed", e instanceof Error ? e.message : e); }
  return counts;
}
