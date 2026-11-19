import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { acceptsBookings, getBusinessBySlug, listBookableServices, logoUrl } from "@/lib/booking/data";
import { formatPence } from "@/lib/money";
import { PublicFooter, PublicHeader } from "./chrome";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const business = await getBusinessBySlug((await params).slug);
  return business ? { title: `Book with ${business.name}` } : { title: "Not found" };
}

export default async function BusinessPage({ params }: Props) {
  const business = await getBusinessBySlug((await params).slug);
  if (!business) notFound();
  const services = acceptsBookings(business) ? await listBookableServices(business.id) : [];

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6">
      <PublicHeader name={business.name} logo={logoUrl(business.logo_path)} />
      <main>
        <h1 className="mb-4 text-xl font-semibold">Choose a service</h1>
        {services.length ? (
          <ul className="space-y-3">
            {services.map((s) => (
              <li key={s.id}>
                <Link href={`/b/${business.slug}/book/${s.id}`}
                  className="block rounded-lg border border-neutral-300 p-4 active:bg-neutral-100 dark:border-neutral-700 dark:active:bg-neutral-800">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{s.name}</span>
                    <span>{s.price_varies ? `from ${formatPence(s.from_pence)}` : formatPence(s.from_pence)}</span>
                  </span>
                  <span className="block text-sm text-neutral-600 dark:text-neutral-400">
                    {s.duration_minutes} min{s.deposit_pence > 0 && ` · ${formatPence(s.deposit_pence)} deposit`}
                  </span>
                  {s.description && <span className="mt-1 block text-sm">{s.description}</span>}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>Online booking isn&apos;t available right now. Please contact {business.name} directly.</p>
        )}
      </main>
      <PublicFooter privacyUrl={business.privacy_notice_url} />
    </div>
  );
}
