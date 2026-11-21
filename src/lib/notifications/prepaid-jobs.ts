import "server-only";
import { billingEnabled } from "@/lib/billing";
import { publicEnv } from "@/lib/env";
import { supportInbox } from "@/lib/support";
import { createAdminClient } from "@/lib/supabase/admin";
import { threeYearEnabled } from "@/lib/three-year-switch";
import { formatDate } from "@/lib/time";
import { prepaidNoticeDue, renderPrepaidNoticeEmail, type PrepaidRow } from "@/lib/trial-email";
import type { Mailers } from "./provider";

type Db = ReturnType<typeof createAdminClient>;

/**
 * Prepaid 3-year plans: closes the ones whose three years are over, and emails the owner 60 and 30 days before the end.
 * Does nothing while the plan is switched off (the database function and columns may not exist yet) or billing is off.
 * Each notice is sent once: the row is claimed (timestamp set) BEFORE sending and released again if the send fails.
 */
export async function runPrepaidJobs(db: Db, mail: Mailers, now: Date = new Date()): Promise<{ closed: number; noticesSent: number }> {
  if (!threeYearEnabled() || !billingEnabled()) return { closed: 0, noticesSent: 0 };

  const expired = await db.rpc("expire_prepaid_terms");
  if (expired.error) console.error("expire_prepaid_terms failed", expired.error.message);
  const closed = Number(expired.data ?? 0);

  const { data: rows, error } = await db.from("business_billing")
    .select("business_id, status, billing_interval, stripe_subscription_id, current_period_end, prepaid_notice_sent_at")
    .eq("status", "active").eq("billing_interval", "three_year").limit(500);
  if (error) { console.error("prepaid notices: could not read billing rows", error.message); return { closed, noticesSent: 0 }; }

  const siteUrl = publicEnv().NEXT_PUBLIC_SITE_URL;
  const from = mail.fromAddress("business");
  const supportEmail = supportInbox(process.env, from);
  let noticesSent = 0;

  for (const r of rows ?? []) {
    const kind = prepaidNoticeDue(r as PrepaidRow, now);
    if (!kind || !r.current_period_end) continue;
    const endMs = new Date(r.current_period_end).getTime();

    // Claim: only the run that flips the marker may send. The first notice claims an empty marker; the second claims one that dates from before the 30-day point.
    const q = db.from("business_billing").update({ prepaid_notice_sent_at: now.toISOString() }).eq("business_id", r.business_id);
    const claim = await (kind === "second" ? q.lt("prepaid_notice_sent_at", new Date(endMs - 30 * 86_400_000).toISOString()) : q.is("prepaid_notice_sent_at", null)).select("business_id");
    if (claim.error || !claim.data?.length) continue;

    try {
      const { data: biz } = await db.from("businesses").select("name, email").eq("id", r.business_id).single();
      let to = biz?.email ?? null;
      if (!to) {
        const { data: owner } = await db.from("business_members").select("user_id").eq("business_id", r.business_id).eq("role", "owner").maybeSingle();
        if (owner) to = (await db.auth.admin.getUserById(owner.user_id)).data.user?.email ?? null;
      }
      if (!biz || !to) continue;
      const rendered = renderPrepaidNoticeEmail({ shopName: biz.name, endsOn: formatDate(r.current_period_end), billingUrl: `${siteUrl}/dashboard/billing`, supportEmail });
      await mail.provider("business").send({ from: `"Booking account" <${from}>`, to, replyTo: supportEmail, ...rendered, idempotencyKey: `prepaid-${kind}:${r.business_id}:${r.current_period_end}` });
      noticesSent++;
    } catch (e) {
      console.error("prepaid notice failed", kind, e instanceof Error ? e.message : e);
      await db.from("business_billing").update({ prepaid_notice_sent_at: kind === "second" ? r.prepaid_notice_sent_at : null }).eq("business_id", r.business_id);
    }
  }
  return { closed, noticesSent };
}
