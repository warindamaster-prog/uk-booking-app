import Link from "next/link";
import { PRICING, pricePence } from "@/lib/pricing";
import { formatPence } from "@/lib/money";
import { threeYearEnabled } from "@/lib/three-year-switch";
import { BrandLogo } from "@/components/brand";
import { sans, serif } from "@/lib/fonts";
import { BookingPreview } from "@/components/landing/booking-preview";
import { Faq, HeaderNav } from "@/components/landing/interactive";
import { Icon, buttonClass } from "@/components/landing/icon";

const features = [
  { icon: "calendar", title: "Your calendar, under control.", copy: "Set your hours, manage your availability, and keep every appointment in one place." },
  { icon: "link", title: "One link. More bookings.", copy: "Share your booking page anywhere. Your customers book in seconds, any time of day." },
  { icon: "bell", title: "Less chasing. More doing.", copy: "Automatic confirmations and reminders, so customers turn up and you spend less time on the phone." },
] as const;

const faqs: [string, string][] = [
  ["Do you take commission on bookings?", "No. You pay a flat monthly fee and nothing on your bookings. Deposits go straight to your own Stripe account."],
  ["Can I try it first?", `Yes. Every business gets a free ${PRICING.trialDays}-day trial with no card needed. You can try the booking page in the preview above, which is a demonstration only and does not create a real appointment.`],
  ["How do I get started?", "Select “Get started”, set up your business in a couple of minutes and share your booking link. Already registered? Use Log in."],
];

const pounds = (pence: number) => `£${pence / 100}`;

/** The plans on the pricing section, all from the real price formula. The 3-year plan only shows while it is on sale. */
function plans() {
  const extra = PRICING.extraSeatMonthlyPence;
  const list = [
    { name: "Monthly", badge: null as string | null, price: formatPence(pricePence(1, "month")), unit: "a month", note: `For the first person taking bookings, then ${pounds(extra)} a month for each extra person.` },
    { name: "Yearly", badge: "2 months free", price: formatPence(pricePence(1, "year")), unit: "a year", note: `12 months for the price of 10. Each extra person is ${pounds(extra * PRICING.yearlyMonthsCharged)} a year.` },
  ];
  if (threeYearEnabled()) {
    const total = pricePence(PRICING.threeYearMinSeats, "three_year");
    list.push({
      name: "3 years, paid once", badge: "35% off", price: formatPence(total), unit: `for ${PRICING.threeYearMinSeats} staff`,
      note: `That is ${formatPence(Math.round(total / PRICING.threeYearMonths))} a month over 3 years. From ${PRICING.threeYearMinSeats} staff. Pay once; it does not renew by itself.`,
    });
  }
  return list;
}

/** What search engines read about the product (JSON-LD). Prices come from the real price formula. */
function structuredData() {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getitbook.com";
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Get It Book",
    url: site,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: "Online booking software for UK small businesses: your own booking page, deposits paid straight to your Stripe account, automatic reminders. No commission.",
    publisher: { "@type": "Organization", name: "WP Precision Systems Ltd", url: site },
    offers: { "@type": "Offer", price: (pricePence(1, "month") / 100).toFixed(2), priceCurrency: "GBP", description: "Per month for the first person taking bookings, excluding VAT. Free for 60 days." },
  }).replace(/</g, "\\u003c");
}

export default function Home() {
  return (
    <div className={`${sans.variable} ${serif.variable} min-h-screen overflow-x-hidden bg-[#fafbf7] font-[family-name:var(--font-dm-sans)] text-[#24392e] selection:bg-[#d5e4c7] [&_.font-serif]:font-[family-name:var(--font-dm-serif)]`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData() }} />
      <header className="relative z-20 mx-auto flex h-24 max-w-[1280px] items-center justify-between gap-5 px-6 lg:px-12">
        <BrandLogo />
        <HeaderNav />
      </header>

      <main>
        <section id="how-it-works" className="relative mx-auto grid max-w-[1280px] items-center gap-14 px-6 pb-16 pt-9 md:grid-cols-2 md:gap-8 lg:gap-16 lg:px-12 lg:pb-20 lg:pt-14">
          <div className="relative z-10 pb-3">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#dde4d5] bg-[#f0f4e9] px-3.5 py-2 text-xs font-medium text-[#45603b]"><span className="h-1.5 w-1.5 rounded-full bg-[#658354]" />Built for independent UK businesses</div>
            <h1 className="font-serif max-w-[600px] text-[48px] leading-[1.08] tracking-[-2px] sm:text-[52px] lg:text-[72px] lg:tracking-[-2.5px]">Your time matters.<br />Make booking<br /><span className="italic text-[#738564]">the easy part.</span></h1>
            <p className="mt-7 max-w-[430px] text-base leading-[1.8] text-stone-600">Less back-and-forth. More time for your business. Simple online booking that works around you, not the other way around.</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/signup" className={`${buttonClass} bg-[#34553e] px-6 py-4 text-white hover:bg-[#25422e]`}>Start your free trial<Icon name="arrow" className="!h-4 !w-4" /></Link>
              <a href="#features" className={`${buttonClass} border border-[#d9ded2] bg-transparent px-5 hover:bg-white`}>See how it works<span className="text-xs">↗</span></a>
            </div>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-stone-600">
              {["Flat monthly fee", "Zero commission", `${PRICING.trialDays}-day free trial`].map((t) => <span key={t} className="flex items-center gap-1.5"><Icon name="check" className="!h-3.5 !w-3.5 text-[#5d7751]" />{t}</span>)}
            </div>
          </div>
          <BookingPreview />
        </section>

        <section className="border-y border-[#e3e7dc] bg-[#f0f3e9] px-6 py-6">
          <div className="mx-auto flex max-w-[1120px] flex-col items-center justify-between gap-5 lg:flex-row">
            <p className="text-sm text-[#54604c]">Big on your business. Small on admin.</p>
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 md:gap-x-12">
              {[["Salons & beauty", "/for/salons-beauty", "✂"], ["Therapists & wellness", "/for/therapists-wellness", "✧"], ["Massage & spas", "/for/massage-spas", "◈"], ["Coaches & tutors", "/for/coaches-tutors-trainers", "⌘"], ["Barbers", "/for/barbers", "✂"], ["Cleaners & home services", "/for/cleaners-home-services", "◇"]].map(([s, href, icon]) => <Link key={s} href={href} className="flex items-center gap-2.5 text-sm font-medium text-[#58634d] hover:text-[#34553e] hover:underline"><span className="text-lg" aria-hidden="true">{icon}</span>{s}</Link>)}
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-[1280px] px-6 py-20 lg:px-12">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div><p className="mb-3 text-xs font-semibold uppercase tracking-[2px] text-[#687b59]">Simply good booking</p><h2 className="font-serif text-4xl tracking-[-1px] lg:text-[44px]">A little less admin. A lot more possibility.</h2></div>
            <p className="max-w-[280px] text-sm leading-6 text-stone-600">Everything you need to take bookings. Nothing to get in your way.</p>
          </div>
          <div className="mt-9 grid gap-5 md:grid-cols-3">
            {features.map((f, i) => (
              <article key={f.title} className="rounded-xl border border-[#e3e7dc] bg-white/60 p-7">
                <div className="mb-7 flex items-center justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#edf1e6] text-[#4e6944]"><Icon name={f.icon} /></div><span className="text-xs text-stone-600">0{i + 1}</span></div>
                <h3 className="text-lg font-semibold tracking-tight">{f.title}</h3>
                <p className="mt-3 text-sm leading-7 text-stone-600">{f.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="pricing" className="mx-6 rounded-2xl bg-[#2e4937] px-6 py-12 text-white lg:mx-auto lg:max-w-[1184px] lg:px-12">
          <div className="flex flex-col items-start justify-between gap-7 md:flex-row md:items-center">
            <div>
              <p className="text-xs font-medium uppercase tracking-[2px] text-[#d6e3cc]">Your business. Your bookings.</p>
              <h2 className="font-serif mt-4 text-4xl tracking-tight">A flat fee. Not a slice of your success.</h2>
              <p className="mt-4 text-sm leading-7 text-[#dce5d7]">No commission on your bookings. Free for {PRICING.trialDays} days, no card needed. All prices exclude VAT.</p>
            </div>
            <Link href="/signup" className={`${buttonClass} shrink-0 bg-[#e9efdd] text-[#2e4937] hover:bg-white`}>Start your free trial<Icon name="arrow" /></Link>
          </div>
          <div className={`mt-10 grid gap-4 ${plans().length === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
            {plans().map((p) => (
              <article key={p.name} className={`rounded-xl border p-6 ${p.badge === "35% off" ? "border-[#cfe3bd] bg-white/10" : "border-white/15 bg-white/5"}`}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">{p.name}</h3>
                  {p.badge && <span className="rounded-full bg-[#e9efdd] px-2.5 py-1 text-xs font-semibold text-[#2e4937]">{p.badge}</span>}
                </div>
                <p className="mt-4 flex items-baseline gap-2"><span className="font-serif text-4xl tracking-tight">{p.price}</span><span className="text-sm text-[#dce5d7]">{p.unit}</span></p>
                <p className="mt-3 text-sm leading-6 text-[#dce5d7]">{p.note}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[850px] px-6 py-20">
          <h2 className="font-serif mb-8 text-center text-4xl tracking-tight">Good questions. Simple answers.</h2>
          <Faq items={faqs} />
        </section>
      </main>

      <footer className="mx-auto flex max-w-[1280px] flex-col items-center justify-between gap-4 border-t border-[#e1e6d9] px-6 py-7 text-xs text-stone-600 md:flex-row lg:px-12">
        <p>© {new Date().getFullYear()} WP Precision Systems. Built for better business.</p>
        <div className="flex gap-6">
          <Link href="/login" className="flex min-h-11 items-center hover:underline">Log in</Link>
          <Link href="/signup" className="flex min-h-11 items-center hover:underline">Get started ↗</Link>
          <Link href="/for" className="flex min-h-11 items-center hover:underline">Who it&apos;s for</Link>
          <Link href="/faq" className="flex min-h-11 items-center hover:underline">Questions</Link>
          <Link href="/privacy" className="flex min-h-11 items-center hover:underline">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}
