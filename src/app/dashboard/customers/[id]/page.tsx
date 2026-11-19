import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { displayStatus, STATUS_LABEL } from "@/lib/calendar";
import { formatPence } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/time";
import { uuid } from "@/lib/validation/catalog";
import { DeleteCustomerForm, WithdrawConsentForm } from "../customer-actions";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const id = uuid.safeParse((await params).id);
  if (!id.success) notFound();
  const { supabase, business } = await requireOwner();

  const { data: c } = await supabase.from("customers")
    .select("id, name, email, phone, marketing_consent, marketing_consent_at, created_at, anonymised_at")
    .eq("id", id.data).eq("business_id", business.id).maybeSingle();
  if (!c || c.anonymised_at) notFound();

  const { data: bookings } = await supabase.from("bookings")
    .select("id, service_name, starts_at, ends_at, status, price_pence").eq("business_id", business.id).eq("customer_id", c.id)
    .order("starts_at", { ascending: false }).limit(50);
  const upcoming = (bookings ?? []).some((b) => (b.status === "confirmed" || b.status === "pending_payment") && new Date(b.starts_at) > new Date());
  const row = "py-2";
  const dt = "text-sm text-neutral-600 dark:text-neutral-400";

  return (
    <main className="space-y-8">
      <p><Link href="/dashboard/customers" className="text-sm underline">← All customers</Link></p>
      <h1 className="text-2xl font-semibold">{c.name}</h1>

      <dl className="divide-y divide-neutral-300 rounded-md border border-neutral-300 px-3 dark:divide-neutral-700 dark:border-neutral-700">
        {c.email && <div className={row}><dt className={dt}>Email</dt><dd><a className="underline" href={`mailto:${c.email}`}>{c.email}</a></dd></div>}
        {c.phone && <div className={row}><dt className={dt}>Phone</dt><dd><a className="underline" href={`tel:${c.phone.replace(/[^+\d]/g, "")}`}>{c.phone}</a></dd></div>}
        <div className={row}><dt className={dt}>First booked</dt><dd>{formatDate(c.created_at, business.timezone)}</dd></div>
        <div className={row}><dt className={dt}>Marketing emails</dt>
          <dd>{c.marketing_consent ? `Agreed on ${formatDate(c.marketing_consent_at ?? c.created_at, business.timezone)}` : "No consent. Don't send them marketing emails."}</dd></div>
      </dl>

      <section aria-labelledby="bk-h" className="space-y-2">
        <h2 id="bk-h" className="text-xl font-semibold">Bookings</h2>
        {bookings?.length ? (
          <ul className="divide-y divide-neutral-300 rounded-md border border-neutral-300 dark:divide-neutral-700 dark:border-neutral-700">
            {bookings.map((b) => (
              <li key={b.id}>
                <Link href={`/dashboard/bookings/${b.id}`} className="flex justify-between gap-3 p-3 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900">
                  <span>{formatDateTime(b.starts_at, business.timezone)} · {b.service_name}</span>
                  <span>{formatPence(b.price_pence)} · {STATUS_LABEL[displayStatus(b)] ?? displayStatus(b)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p>No bookings.</p>}
      </section>

      <section aria-labelledby="priv-h" className="space-y-4">
        <h2 id="priv-h" className="text-xl font-semibold">Privacy</h2>
        <p className="text-sm">
          If this customer asks what you hold about them, download a copy. If they ask you to delete their details, you can do that below.
        </p>
        <p>
          <a href={`/dashboard/customers/${c.id}/export`} download
            className="inline-flex min-h-11 items-center rounded-md border border-neutral-400 px-4 py-2 text-sm">Download their data (JSON file)</a>
        </p>
        {c.marketing_consent && <WithdrawConsentForm id={c.id} />}
        {upcoming
          ? <p className="rounded-md border border-neutral-400 p-3 text-sm">To delete this customer&apos;s details, first cancel their upcoming bookings.</p>
          : <DeleteCustomerForm id={c.id} name={c.name} />}
      </section>
    </main>
  );
}
