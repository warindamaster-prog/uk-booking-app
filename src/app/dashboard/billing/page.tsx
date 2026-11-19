import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth";
import { trialDaysLeft } from "@/lib/billing";
import { formatPence } from "@/lib/money";
import { grossPence, vatPence } from "@/lib/pricing";
import { formatDate } from "@/lib/time";
import { CancelReductionForm } from "./cancel-form";
import { SeatsForm } from "./seats-form";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage() {
  const { supabase, business } = await requireOwner();
  const { data: b } = await supabase.from("business_billing").select("*").eq("business_id", business.id).maybeSingle();
  const { count } = await supabase.from("staff").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("active", true);
  if (!b) return <main><p>We couldn&apos;t find your billing details. Please contact support.</p></main>;

  const per = b.billing_interval as "month" | "year";
  const line = (pence: number) => `${formatPence(pence)} + ${formatPence(vatPence(pence))} VAT = ${formatPence(grossPence(pence))}`;
  const row = "flex justify-between gap-4 py-2";

  return (
    <main className="space-y-8">
      <h1 className="text-2xl font-semibold">Billing</h1>

      {b.status === "trialing" && (
        <p role="status" className="rounded-md bg-neutral-100 p-3 text-sm dark:bg-neutral-800">
          You&apos;re on a free trial: {trialDaysLeft(b.trial_ends_at)} days left (until {formatDate(b.trial_ends_at)}). No card is needed until we launch.
        </p>
      )}

      <section aria-labelledby="plan-h">
        <h2 id="plan-h" className="mb-2 text-xl font-semibold">Your plan</h2>
        <dl className="divide-y divide-neutral-300 rounded-md border border-neutral-300 px-3 dark:divide-neutral-700 dark:border-neutral-700">
          <div className={row}><dt>Team members paid for</dt><dd>{b.staff_seats} ({count ?? 0} in use)</dd></div>
          <div className={row}><dt>Billing</dt><dd>{per === "year" ? "Yearly" : "Monthly"}</dd></div>
          <div className={row}><dt>{b.status === "trialing" ? `Price after trial (per ${per})` : `Price this ${per}`}</dt><dd>{line(b.current_price_pence)}</dd></div>
          {b.next_staff_seats !== null && b.next_price_pence !== null && b.change_effective_at && (
            <div className={row}>
              <dt>From {formatDate(b.change_effective_at)}</dt>
              <dd>{b.next_staff_seats} team members, {line(b.next_price_pence)}</dd>
            </div>
          )}
        </dl>
        {b.next_staff_seats !== null && <div className="mt-2"><CancelReductionForm current={b.staff_seats} /></div>}
      </section>

      <section aria-labelledby="team-h" className="space-y-3">
        <h2 id="team-h" className="text-xl font-semibold">Change team size</h2>
        <SeatsForm current={b.next_staff_seats ?? b.staff_seats} interval={per} hasSubscription={!!b.stripe_subscription_id} />
      </section>
    </main>
  );
}
