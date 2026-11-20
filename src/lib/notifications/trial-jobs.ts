import "server-only";
import { billingEnabled, noTrialMode } from "@/lib/billing";
import { publicEnv } from "@/lib/env";
import { formatDate } from "@/lib/time";
import { renderTrialEndedEmail, renderTrialReminderEmail, trialEmailDue, type TrialRow } from "@/lib/trial-email";
import { supportInbox } from "@/lib/support";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Mailers } from "./provider";

type Db = ReturnType<typeof createAdminClient>;

/**
 * Emails shops about their free trial: a reminder a week before it ends, and one note after it ended without a
 * subscription. Each is sent once: the row is claimed (timestamp set) BEFORE sending, and released again if the
 * send fails so the next run retries. Does nothing while billing is off or in the no-trial test mode.
 */
export async function runTrialEmails(db: Db, mail: Mailers, now: Date = new Date()): Promise<number> {
  if (!billingEnabled() || noTrialMode()) return 0;
  const { data: rows, error } = await db.from("business_billing")
    .select("business_id, status, trial_ends_at, created_at, stripe_subscription_id, trial_reminder_sent_at, trial_ended_email_sent_at")
    .eq("status", "trialing").limit(500);
  if (error) { console.error("trial emails: could not read billing rows", error.message); return 0; }

  const siteUrl = publicEnv().NEXT_PUBLIC_SITE_URL;
  const from = mail.fromAddress("business");
  const supportEmail = supportInbox(process.env, from);
  let sent = 0;

  for (const r of rows ?? []) {
    const kind = trialEmailDue(r as TrialRow, now);
    if (!kind) continue;
    const column = kind === "reminder" ? "trial_reminder_sent_at" : "trial_ended_email_sent_at";

    // Claim: only the run that flips null -> now may send.
    const claim = await db.from("business_billing").update({ [column]: now.toISOString() }).eq("business_id", r.business_id).is(column, null).select("business_id");
    if (claim.error || !claim.data?.length) continue;

    try {
      const { data: biz } = await db.from("businesses").select("name, email").eq("id", r.business_id).single();
      let to = biz?.email ?? null;
      if (!to) {
        const { data: owner } = await db.from("business_members").select("user_id").eq("business_id", r.business_id).eq("role", "owner").maybeSingle();
        if (owner) to = (await db.auth.admin.getUserById(owner.user_id)).data.user?.email ?? null;
      }
      if (!biz || !to) continue; // nobody to tell; left marked so we don't look again every 15 minutes
      const billingUrl = `${siteUrl}/dashboard/billing`;
      const rendered = kind === "reminder"
        ? renderTrialReminderEmail({ shopName: biz.name, endsOn: formatDate(r.trial_ends_at), hasCard: !!r.stripe_subscription_id, billingUrl, supportEmail })
        : renderTrialEndedEmail({ shopName: biz.name, billingUrl, supportEmail });
      await mail.provider("business").send({
        from: `"Booking account" <${from}>`, to, replyTo: supportEmail, ...rendered,
        idempotencyKey: `trial-${kind}:${r.business_id}`,
      });
      sent++;
    } catch (e) {
      console.error("trial email failed", kind, e instanceof Error ? e.message : e);
      await db.from("business_billing").update({ [column]: null }).eq("business_id", r.business_id); // try again next run
    }
  }
  return sent;
}
