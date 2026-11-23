import type { Metadata } from "next";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPence } from "@/lib/money";
import { grossPence } from "@/lib/pricing";
import { refundPrepaid } from "./actions";

export const metadata: Metadata = { title: "Refund 3-year plans", robots: { index: false, follow: false } };

const daysSince = (d: Date) => Math.floor((Date.now() - d.getTime()) / 86_400_000);

export default async function RefundsPage({ searchParams }: { searchParams: Promise<{ done?: string; error?: string }> }) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const db = createAdminClient();
  const { data } = await db.from("business_billing")
    .select("business_id, staff_seats, prepaid_paid_at, paid_this_period_pence, current_period_end, businesses(name, slug)")
    .eq("billing_interval", "three_year").eq("status", "active").not("prepaid_payment_intent_id", "is", null).order("prepaid_paid_at", { ascending: false });
  const rows = (data ?? []).map((r) => ({ ...r, business: Array.isArray(r.businesses) ? r.businesses[0] : r.businesses }));

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">Refund 3-year plans</h1>
      <p className="text-sm">For a shop that asks for its money back within 14 days. The button issues a credit note on the Stripe invoice, refunds the card in full, and closes the shop&apos;s plan (back to its free trial if that is still running). Stripe keeps its own fee. This cannot be undone.</p>
      {sp.done && <p role="status" className="rounded-md border border-green-700 p-3 text-sm text-green-800">{sp.done}</p>}
      {sp.error && <p role="alert" className="rounded-md border border-red-700 p-3 text-sm text-red-700">{sp.error}</p>}
      {rows.length === 0 ? <p className="text-sm">No shop has a paid 3-year plan.</p> : (
        <ul className="space-y-4">
          {rows.map((r) => {
            const paid = r.prepaid_paid_at ? new Date(r.prepaid_paid_at) : null;
            const days = paid ? daysSince(paid) : null;
            return (
              <li key={r.business_id} className="rounded-lg border border-neutral-300 p-4">
                <p className="font-medium">{r.business?.name} <span className="font-normal text-neutral-600">({r.business?.slug})</span></p>
                <p className="mt-1 text-sm">{r.staff_seats} people. Paid {paid ? paid.toLocaleDateString("en-GB") : "?"}{days !== null && ` (${days} day${days === 1 ? "" : "s"} ago)`}. Plan to {r.current_period_end ? new Date(r.current_period_end).toLocaleDateString("en-GB") : "?"}.</p>
                <p className="mt-1 text-sm">Price list: {formatPence(grossPence(r.paid_this_period_pence))} incl. VAT. Stripe may show a different amount if a test price was used: the refund is the amount actually paid on the invoice.</p>
                {days !== null && days > 14 && <p className="mt-1 text-sm text-red-700">More than 14 days ago: outside the refund promise.</p>}
                <form action={refundPrepaid} className="mt-3 space-y-2">
                  <input type="hidden" name="businessId" value={r.business_id} />
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirm" className="h-5 w-5" /> I have checked this refund and want to make it.</label>
                  <button type="submit" className="min-h-11 rounded-md bg-red-700 px-4 text-sm font-semibold text-white">Refund in full and close the plan</button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
