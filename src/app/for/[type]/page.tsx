import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd, MarketingShell } from "@/components/marketing/shell";
import { Icon, buttonClass } from "@/components/landing/icon";
import { formatPence } from "@/lib/money";
import { PRICING, pricePence } from "@/lib/pricing";
import { BUSINESS_PAGES, bySlug } from "@/lib/seo-pages";

type Props = { params: Promise<{ type: string }> };

export const dynamicParams = false;
export function generateStaticParams() { return BUSINESS_PAGES.map((p) => ({ type: p.slug })); }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = bySlug((await params).type);
  if (!page) return {};
  return {
    title: page.metaTitle,
    description: page.description,
    alternates: { canonical: `/for/${page.slug}` },
    openGraph: { type: "website", title: page.metaTitle, description: page.description, url: `/for/${page.slug}` },
  };
}

const steps = [
  { title: "Add your services", text: "Name, length, price, and an optional deposit for each one." },
  { title: "Set your hours", text: "Working days and hours for you and your team, plus days off." },
  { title: "Share your link", text: "Put it on your website, Instagram, WhatsApp or business card. Clients book from their phone." },
];

export default async function BusinessPage({ params }: Props) {
  const page = bySlug((await params).type);
  if (!page) notFound();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getitbook.com";
  const others = BUSINESS_PAGES.filter((p) => p.slug !== page.slug);

  return (
    <MarketingShell>
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "FAQPage",
        mainEntity: page.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      }} />
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Get It Book", item: site },
          { "@type": "ListItem", position: 2, name: "Who it's for", item: `${site}/for` },
          { "@type": "ListItem", position: 3, name: page.label, item: `${site}/for/${page.slug}` },
        ],
      }} />

      <section className="mx-auto max-w-[1100px] px-6 pb-12 pt-6 lg:px-12">
        <nav aria-label="Breadcrumb" className="mb-6 text-xs text-stone-500"><Link href="/for" className="hover:underline">Who it&apos;s for</Link> / {page.label}</nav>
        <h1 className="font-serif max-w-[820px] text-[38px] leading-[1.1] tracking-[-1.5px] sm:text-[48px] lg:text-[58px]">{page.h1}</h1>
        <p className="mt-6 max-w-[680px] text-lg leading-8 text-stone-600">{page.lead}</p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/signup" className={`${buttonClass} bg-[#34553e] px-6 py-4 text-white hover:bg-[#25422e]`}>Start your free trial<Icon name="arrow" className="!h-4 !w-4" /></Link>
          <Link href="/" className={`${buttonClass} border border-[#d9ded2] hover:bg-white`}>See prices</Link>
        </div>
        <p className="mt-4 text-xs text-stone-500">Free for {PRICING.trialDays} days, no card needed. From {formatPence(pricePence(1, "month"))} a month + VAT after that. No commission on your bookings.</p>
      </section>

      <section className="mx-auto max-w-[1100px] px-6 py-12 lg:px-12">
        <h2 className="font-serif text-3xl tracking-tight">What gets easier</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {page.problems.map((p) => (
            <article key={p.title} className="rounded-xl border border-[#e3e7dc] bg-white/60 p-6">
              <h3 className="text-lg font-semibold tracking-tight">{p.title}</h3>
              <p className="mt-3 text-sm leading-7 text-stone-600">{p.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-6 py-12 lg:px-12">
        <h2 className="font-serif text-3xl tracking-tight">How it works in three steps</h2>
        <ol className="mt-8 grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="rounded-xl border border-[#e3e7dc] bg-white/60 p-6">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#34553e] text-sm font-semibold text-white">{i + 1}</span>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-7 text-stone-600">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto grid max-w-[1100px] gap-8 px-6 py-12 lg:grid-cols-2 lg:px-12">
        <div>
          <h2 className="font-serif text-3xl tracking-tight">An example set-up</h2>
          <ul className="mt-6 divide-y divide-[#e3e7dc] rounded-xl border border-[#e3e7dc] bg-white">
            {page.example.map((s) => (
              <li key={s.name} className="flex items-baseline justify-between gap-4 px-5 py-4">
                <span><span className="font-medium">{s.name}</span>{s.deposit ? <span className="mt-1 block text-xs text-stone-500">£{s.deposit} deposit paid when booking</span> : null}</span>
                <span className="font-semibold">{s.price === 0 ? "Free" : `£${s.price}`}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-stone-500">{page.exampleNote}</p>
        </div>
        <div className="space-y-6">
          <div>
            <h2 className="font-serif text-3xl tracking-tight">Deposits and cancellations</h2>
            <p className="mt-4 text-sm leading-7 text-stone-600">{page.depositText}</p>
            <p className="mt-3 text-sm leading-7 text-stone-600">Deposits are paid by card to <strong>your own Stripe account</strong>. We take no commission and never hold your money; Stripe&apos;s normal card fees apply.</p>
          </div>
          <div>
            <h2 className="font-serif text-2xl tracking-tight">Your team</h2>
            <p className="mt-3 text-sm leading-7 text-stone-600">{page.teamText}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[850px] px-6 py-12">
        <h2 className="font-serif text-3xl tracking-tight">Questions</h2>
        <dl className="mt-6 divide-y divide-[#dfe4d8] border-y border-[#dfe4d8]">
          {page.faqs.map((f) => (
            <div key={f.q} className="py-5"><dt className="font-semibold">{f.q}</dt><dd className="mt-2 text-sm leading-7 text-stone-600">{f.a}</dd></div>
          ))}
        </dl>
        <p className="mt-4 text-sm"><Link href="/faq" className="text-[#34553e] underline">More questions and answers</Link></p>
      </section>

      <section className="mx-6 my-12 rounded-2xl bg-[#2e4937] px-6 py-12 text-white lg:mx-auto lg:max-w-[1100px] lg:px-12">
        <h2 className="font-serif text-3xl tracking-tight">Try it with your own services</h2>
        <p className="mt-3 max-w-xl text-sm leading-7 text-[#dce5d7]">Set up in a few minutes. Free for {PRICING.trialDays} days, no card needed.</p>
        <Link href="/signup" className={`${buttonClass} mt-6 bg-[#e9efdd] text-[#2e4937] hover:bg-white`}>Start your free trial<Icon name="arrow" /></Link>
      </section>

      <section className="mx-auto max-w-[1100px] px-6 pb-16 lg:px-12">
        <h2 className="text-sm font-semibold uppercase tracking-[1.5px] text-[#687b59]">Also for</h2>
        <ul className="mt-3 flex flex-wrap gap-3">{others.map((p) => <li key={p.slug}><Link href={`/for/${p.slug}`} className="inline-flex min-h-11 items-center rounded-lg border border-[#d9ded2] bg-white px-4 text-sm hover:bg-[#f1f5ed]">{p.label}</Link></li>)}</ul>
      </section>
    </MarketingShell>
  );
}
