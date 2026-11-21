import { cancelDepositNote, depositPolicyText } from "@/lib/deposit-policy";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBusinessBySlug, logoUrl } from "@/lib/booking/data";
import { byteaParam, hashToken, TOKEN_RE } from "@/lib/booking/token";
import { formatPence } from "@/lib/money";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/time";
import { shopBase } from "@/lib/shop-base";
import { PublicShell } from "../../chrome";
import { AutoRefresh } from "./auto-refresh";
import { CancelForm } from "./cancel-form";

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

export default async function BookingPage({ params, searchParams }: { params: Promise<{ slug: string; token: string }>; searchParams: Promise<{ paid?: string }> }) {
  const { slug, token } = await params;
  const { paid } = await searchParams;
  if (!TOKEN_RE.test(token)) notFound();
  const business = await getBusinessBySlug(slug);
  if (!business) notFound();
  const shop = await shopBase(business.slug);

  const db = createAdminClient();
  const { data: b } = await db.from("bookings")
    .select("status, starts_at, service_name, duration_minutes, price_pence, deposit_pence, deposit_status, staff_id")
    .eq("cancel_token_hash", byteaParam(hashToken(token))).eq("business_id", business.id).maybeSingle();
  if (!b) notFound();
  const { data: staff } = await db.from("staff").select("name").eq("id", b.staff_id).eq("business_id", business.id).maybeSingle();

  // Customers can cancel online until the business's cancellation window starts (unpaid holds: any time).
  const start = new Date(b.starts_at);
  const deadline = new Date(start.getTime() - business.cancellation_window_hours * 3_600_000);
  const upcoming = start > new Date();
  const canCancel = upcoming && (b.status === "pending_payment" || (b.status === "confirmed" && new Date() <= deadline));
  const cancelNote = !upcoming || !["confirmed", "pending_payment"].includes(b.status) ? null
    : canCancel && b.status === "confirmed"
      ? <p className="text-sm">You can cancel online until {formatDateTime(deadline, business.timezone)}.</p>
      : !canCancel ? <p className="text-sm">Online cancellation has closed. To change or cancel, please reply to your confirmation email or contact {business.name} directly.</p> : null;

  return (
    <PublicShell accent={business.accent_color} base={shop} name={business.name} logo={logoUrl(business.logo_path)} privacyUrl={business.privacy_notice_url}>
      <div className="space-y-4">
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-1px]">{STATUS[b.status] ?? "Your booking"}</h1>
        {b.status === "pending_payment" && paid && (
          <>
            <p role="status">Thank you. We&apos;re confirming your payment, which usually takes a few seconds.</p>
            <AutoRefresh />
          </>
        )}
        {b.status === "pending_payment" && !paid && (
          <p>This time is held while your deposit is paid. If you didn&apos;t finish paying, the time will be released shortly and you can book again.</p>
        )}
        <dl className="space-y-3 rounded-2xl border border-[color:var(--brand-line,#e0e5df)] bg-white p-6">
          <div><dt className="text-sm text-[color:var(--brand-muted,#6b756d)]">Service</dt><dd>{b.service_name} ({b.duration_minutes} min)</dd></div>
          <div><dt className="text-sm text-[color:var(--brand-muted,#6b756d)]">When</dt><dd>{formatDateTime(b.starts_at, business.timezone)}</dd></div>
          {staff && <div><dt className="text-sm text-[color:var(--brand-muted,#6b756d)]">With</dt><dd>{staff.name}</dd></div>}
          <div><dt className="text-sm text-[color:var(--brand-muted,#6b756d)]">Price</dt>
            <dd>{formatPence(b.price_pence)}{b.deposit_pence > 0 && ` (deposit ${formatPence(b.deposit_pence)}${b.deposit_status === "paid" ? ", paid" : ""})`}</dd></div>
        </dl>
        {b.deposit_pence > 0 && ["confirmed", "pending_payment"].includes(b.status) && (
          <p className="whitespace-pre-wrap text-sm">{depositPolicyText({ policy: business.deposit_policy, refundable: business.deposit_refundable, windowHours: business.cancellation_window_hours, businessName: business.name })}</p>
        )}
        {cancelNote}
        {canCancel && <CancelForm slug={business.slug} token={token} depositNote={cancelDepositNote({ refundable: business.deposit_refundable, depositPaid: b.deposit_status === "paid", businessName: business.name })} />}
        {business.contact && (business.contact.email || business.contact.phone) && (
          <p className="text-sm">
            Questions? Contact {business.name}:{" "}
            {business.contact.email && <a className="underline" href={`mailto:${business.contact.email}`}>{business.contact.email}</a>}
            {business.contact.email && business.contact.phone && " · "}
            {business.contact.phone && <a className="underline" href={`tel:${business.contact.phone.replace(/[^+\d]/g, "")}`}>{business.contact.phone}</a>}
          </p>
        )}
        <p className="text-sm">Keep this page&apos;s link to see your booking again.</p>
        <p>
          <Link href={shop || "/"} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[color:var(--brand-line,#dfe5da)] bg-white px-4 text-sm font-medium text-[color:var(--brand-muted,#415044)] transition hover:bg-[color:var(--brand-softer,#f1f5ed)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring,#397451)]">
            Book another appointment <span aria-hidden="true">→</span>
          </Link>
        </p>
      </div>
    </PublicShell>
  );
}
