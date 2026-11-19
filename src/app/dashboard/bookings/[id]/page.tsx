import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { allowedActions, displayStatus, STATUS_LABEL } from "@/lib/calendar";
import { fetchBooking } from "@/lib/dashboard/bookings";
import { formatPence } from "@/lib/money";
import { formatDateTime, formatTime } from "@/lib/time";
import { uuid } from "@/lib/validation/catalog";
import { BookingActions } from "../booking-actions";

export const metadata: Metadata = { title: "Booking" };

export default async function BookingPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ moved?: string }>;
}) {
  const id = uuid.safeParse((await params).id);
  if (!id.success) notFound();
  const { supabase, business, role } = await requireBusiness();
  const b = await fetchBooking(supabase, business.id, id.data);
  if (!b) notFound();
  const { moved } = await searchParams;
  const tz = business.timezone;
  const can = allowedActions(b);
  const row = "py-2";
  const dt = "text-sm text-neutral-600 dark:text-neutral-400";

  return (
    <main className="space-y-8">
      <p><Link href="/dashboard/bookings" className="text-sm underline">← All bookings</Link></p>
      <div>
        <h1 className="text-2xl font-semibold">{b.service_name}</h1>
        <p className="mt-1"><span className="rounded border border-neutral-400 px-2 py-0.5 text-sm">{STATUS_LABEL[displayStatus(b)] ?? displayStatus(b)}</span></p>
      </div>
      {moved && <p role="status" className="rounded-md border border-green-700 p-3 text-sm text-green-800 dark:text-green-400">Booking moved.</p>}

      <dl className="divide-y divide-neutral-300 rounded-md border border-neutral-300 px-3 dark:divide-neutral-700 dark:border-neutral-700">
        <div className={row}><dt className={dt}>When</dt><dd>{formatDateTime(b.starts_at, tz)} to {formatTime(b.ends_at, tz)} ({b.duration_minutes} min)</dd></div>
        <div className={row}><dt className={dt}>With</dt><dd>{b.staffName}</dd></div>
        <div className={row}><dt className={dt}>Price</dt>
          <dd>{formatPence(b.price_pence)}{b.deposit_pence > 0 && ` (deposit ${formatPence(b.deposit_pence)}: ${b.deposit_status})`}</dd></div>
        {b.cancelled_at && <div className={row}><dt className={dt}>Cancelled</dt><dd>{formatDateTime(b.cancelled_at, tz)}{b.cancelled_by && ` by the ${b.cancelled_by}`}</dd></div>}
      </dl>

      <section aria-labelledby="cust-h" className="space-y-2">
        <h2 id="cust-h" className="text-xl font-semibold">Customer</h2>
        {b.customer ? (
          <dl className="divide-y divide-neutral-300 rounded-md border border-neutral-300 px-3 dark:divide-neutral-700 dark:border-neutral-700">
            <div className={row}><dt className={dt}>Name</dt><dd>{b.customer.name}</dd></div>
            {b.customer.email && <div className={row}><dt className={dt}>Email</dt><dd><a className="underline" href={`mailto:${b.customer.email}`}>{b.customer.email}</a></dd></div>}
            {b.customer.phone && <div className={row}><dt className={dt}>Phone</dt><dd><a className="underline" href={`tel:${b.customer.phone.replace(/[^+\d]/g, "")}`}>{b.customer.phone}</a></dd></div>}
          </dl>
        ) : <p>Customer details are not available.</p>}
      </section>

      <BookingActions id={b.id} can={can} depositPaid={b.deposit_status === "paid"} canRefund={role === "owner" && b.deposit_status === "paid"} />
    </main>
  );
}
