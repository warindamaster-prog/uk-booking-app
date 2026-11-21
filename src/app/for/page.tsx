import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing/shell";
import { BUSINESS_PAGES } from "@/lib/seo-pages";

export const metadata: Metadata = {
  title: "Online booking for UK service businesses",
  description: "Get It Book is online booking for massage therapists, salons, barbers, therapists, cleaners, coaches and tutors in the UK. Your own booking page, deposits to your own Stripe account, no commission.",
  alternates: { canonical: "/for" },
};

export default function ForPage() {
  return (
    <MarketingShell>
      <section className="mx-auto max-w-[1100px] px-6 pb-8 pt-6 lg:px-12">
        <h1 className="font-serif max-w-[820px] text-[38px] leading-[1.1] tracking-[-1.5px] sm:text-[48px] lg:text-[58px]">Online booking for businesses that work by appointment</h1>
        <p className="mt-6 max-w-[680px] text-lg leading-8 text-stone-600">One booking page for your business, confirmation and reminder emails, deposits paid straight to your Stripe account, and a flat monthly fee with no commission. Pick the kind of business that is closest to yours.</p>
      </section>
      <section className="mx-auto max-w-[1100px] px-6 pb-20 pt-6 lg:px-12">
        <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {BUSINESS_PAGES.map((p) => (
            <li key={p.slug}>
              <Link href={`/for/${p.slug}`} className="block h-full rounded-xl border border-[#e3e7dc] bg-white/60 p-6 transition hover:border-[#789467] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#397451]">
                <h2 className="text-lg font-semibold tracking-tight">{p.label}</h2>
                <p className="mt-3 text-sm leading-7 text-stone-600">{p.description}</p>
                <span className="mt-4 inline-block text-sm font-medium text-[#34553e]">Read more →</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </MarketingShell>
  );
}
