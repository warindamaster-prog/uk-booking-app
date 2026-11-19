import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBusinessBySlug, logoUrl } from "@/lib/booking/data";
import { byteaParam, hashToken, TOKEN_RE } from "@/lib/booking/token";
import { formatPence } from "@/lib/money";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/time";
import { PublicFooter, PublicHeader } from "../../chrome";

// The token is a credential: keep the page out of search engines and out of Referer headers.
export const metadata: Metadata = { title: "Your booking", robots: { index: false, follow: false }, referrer: "no-referrer" };

const STATUS: Record<string, string> = {
  confirmed: "Your booking is confirmed",
  pending_payment: "Waiting for your deposit",
  cancelled: "This booking was cancelled",
  expired: "This booking expired",
  no_show: "Booking marked as missed",
  completed: "Booking completed",
};

export default async function BookingPage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  if (!TOKEN_RE.test(token)) notFound();
  const business = await getBusinessBySlug(slug);
  if (!business) notFound();

  const db = createAdminClient();
  const { data: b } = await db.from("bookings")
    .select("status, starts_at, service_name, duration_minutes, price_pence, deposit_pence, deposit_status, staff_id")
    .eq("cancel_token_hash", byteaParam(hashToken(token))).eq("business_id", business.id).maybeSingle();
  if (!b) notFound();
  const { data: staff } = await db.from("staff").select("name").eq("id", b.staff_id).eq("business_id", business.id).maybeSingle();

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6">
      <PublicHeader name={business.name} logo={logoUrl(business.logo_path)} />
      <main className="space-y-4">
        <h1 className="text-xl font-semibold">{STATUS[b.status] ?? "Your booking"}</h1>
        <dl className="space-y-3 rounded-lg border border-neutral-300 p-4 dark:border-neutral-700">
          <div><dt className="text-sm text-neutral-600 dark:text-neutral-400">Service</dt><dd>{b.service_name} ({b.duration_minutes} min)</dd></div>
          <div><dt className="text-sm text-neutral-600 dark:text-neutral-400">When</dt><dd>{formatDateTime(b.starts_at, business.timezone)}</dd></div>
          {staff && <div><dt className="text-sm text-neutral-600 dark:text-neutral-400">With</dt><dd>{staff.name}</dd></div>}
          <div><dt className="text-sm text-neutral-600 dark:text-neutral-400">Price</dt>
            <dd>{formatPence(b.price_pence)}{b.deposit_pence > 0 && ` (deposit ${formatPence(b.deposit_pence)}${b.deposit_status === "paid" ? ", paid" : ""})`}</dd></div>
        </dl>
        <p className="text-sm">Keep this page&apos;s link to see your booking again.</p>
        <p><Link href={`/b/${business.slug}`} className="text-sm underline">Book another appointment</Link></p>
      </main>
      <PublicFooter privacyUrl={business.privacy_notice_url} />
    </div>
  );
}
