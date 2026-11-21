import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { acceptsBookings, getBusinessBySlug, listBookableServices, logoUrl } from "@/lib/booking/data";
import { formatPence } from "@/lib/money";
import { shopBase } from "@/lib/shop-base";
import { PublicShell } from "./chrome";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const business = await getBusinessBySlug((await params).slug);
  return business ? { title: `Book with ${business.name}` } : { title: "Not found" };
}

export default async function BusinessPage({ params }: Props) {
  const business = await getBusinessBySlug((await params).slug);
  if (!business) notFound();
  const base = await shopBase(business.slug);
  const services = acceptsBookings(business) ? await listBookableServices(business.id) : [];

  return (
    <PublicShell accent={business.accent_color} base={base} name={business.name} logo={logoUrl(business.logo_path)} privacyUrl={business.privacy_notice_url} step={1} summary={{}}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[1.5px] text-[#738064]">Let&apos;s get you booked</p>
      <h1 className="text-[28px] font-semibold leading-tight tracking-[-1px]">Choose your service</h1>
      <p className="mb-6 mt-2 text-sm text-[#6b756d]">Pick a service, then find a day and time that suits you.</p>
      {services.length ? (
        <ul className="space-y-3">
          {services.map((s) => (
            <li key={s.id}>
              <Link href={`${base}/book/${s.id}`}
                className="group block rounded-xl border border-[#dfe5da] bg-white p-5 transition hover:border-[color:var(--brand-border,#789467)] hover:shadow-[0_0_0_1px_#78946720] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring,#397451)] sm:p-6">
                <span className="flex items-start justify-between gap-4">
                  <span className="min-w-0">
                    <span className="block text-lg font-semibold tracking-tight">{s.name}</span>
                    <span className="mt-2 block text-sm text-[#6b756d]">
                      {s.duration_minutes} minutes{s.deposit_pence > 0 && ` · pay ${formatPence(s.deposit_pence)} deposit now`}
                    </span>
                    {s.description && <span className="mt-3 block text-sm leading-6 text-[#687564]">{s.description}</span>}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-lg font-semibold tracking-tight">{s.price_varies ? `from ${formatPence(s.from_pence)}` : formatPence(s.from_pence)}</span>
                    <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-[color:var(--brand,#215b48)] group-hover:underline">Choose <span aria-hidden="true">→</span></span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl bg-[color:var(--brand-soft,#edf1e7)] p-5 text-sm">Online booking isn&apos;t available right now. Please contact {business.name} directly.</p>
      )}
    </PublicShell>
  );
}
