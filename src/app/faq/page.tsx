import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd, MarketingShell } from "@/components/marketing/shell";
import { Icon, buttonClass } from "@/components/landing/icon";
import { formatPence } from "@/lib/money";
import { PRICING, pricePence } from "@/lib/pricing";
import { threeYearEnabled } from "@/lib/three-year-switch";
import type { Faq } from "@/lib/seo-pages";

export const metadata: Metadata = {
  title: "Questions and answers about Get It Book",
  description: "Prices, the free trial, deposits, Stripe, VAT, cancellations, reminders, data protection and languages: answers about Get It Book online booking for UK businesses.",
  alternates: { canonical: "/faq" },
};

function questions(): Faq[] {
  const base = formatPence(pricePence(1, "month"));
  const extra = formatPence(PRICING.extraSeatMonthlyPence);
  const list: Faq[] = [
    { q: "How much does Get It Book cost?", a: `${base} a month for the first person who takes bookings, then ${extra} a month for each extra person. Pay yearly and you pay for 10 months instead of 12. Prices exclude VAT (20%).` },
    { q: "Is there a free trial?", a: `Yes. Every business gets ${PRICING.trialDays} days free, and no card is needed to start. You can add a card during the trial, and nothing is charged until the trial ends.` },
    { q: "What happens when the free trial ends?", a: "Your online booking page closes, so customers cannot book. You can still log in and see your bookings and customers; nothing is deleted. Subscribe and the booking page opens again." },
    { q: "Do you take commission on my bookings?", a: "No. You pay a flat monthly fee. We never take a share of what your customers pay you." },
    { q: "How do deposits work?", a: "You can ask for a deposit on any service. The customer pays by card when they book, straight to your own Stripe account, and the booking is confirmed once the payment arrives. We never hold your money. Stripe's normal card fees apply to the payment." },
    { q: "Can a customer get their deposit back?", a: "You choose. By default a deposit is refunded automatically when the customer cancels before your cancellation cut-off time, and kept after it. You can instead decide that deposits are not refunded, and write your own deposit policy that customers see before they pay. You can also refund a deposit by hand." },
    { q: "What do customers receive?", a: "A confirmation email with the details and a calendar file, a reminder before the appointment, and a link to view or cancel the booking until your cut-off time. You receive a notification for each booking." },
    { q: "Can I send emails from my own address?", a: "Yes. In Settings you can connect your own email account, such as Gmail, Outlook or your domain's mail provider, so booking emails come from a name your customers know. Without this they come from our standard sender and replies reach you." },
    { q: "Can I have more than one person taking bookings?", a: "Yes. Each person has their own working hours, days off and list of services. Customers can choose a person or take the first free time. Prices can differ by person or level." },
    { q: "Is the dashboard available in Thai?", a: "Yes. The dashboard, sign-in and set-up pages have an EN / ไทย switch. Your customers' booking page and emails are in English." },
    { q: "Can I change the colours of my booking page?", a: "Yes. Choose one of the ready-made colours in Settings, and your dashboard and your customers' booking page use it." },
    { q: "Does it work on a phone?", a: "Yes, for you and for your customers. The booking page and the dashboard are built for phone screens as well as computers." },
    { q: "Who sees my customers' data?", a: "You do, and the people on your team. The details are used to manage the booking. You can export or erase a customer's details on request. See the privacy notice for how personal data is used." },
    { q: "Do I need a website?", a: "No. You get a booking page at your own address, such as yourshop.getitbook.com. You can share it on social media or messages, or link to it from a website you already have." },
    { q: "Is it only for UK businesses?", a: "It is built for UK businesses today: prices in pounds, UK time, UK card payments through Stripe." },
    { q: "Can I cancel?", a: "Yes. Once you have a subscription, the Billing page takes you to Stripe's page for your card, invoices and cancellation. After you cancel, your booking page closes but you can still log in and see your bookings." },
  ];
  if (threeYearEnabled()) {
    const total = formatPence(pricePence(PRICING.threeYearMinSeats, "three_year"));
    list.splice(1, 0, { q: "Is there a cheaper way to pay?", a: `Yes. Pay yearly and get 2 months free, or choose the 3-year plan: ${total} + VAT once for ${PRICING.threeYearMinSeats} staff, 35% off the monthly price. It does not renew by itself.` });
  }
  return list;
}

export default function FaqPage() {
  const items = questions();
  return (
    <MarketingShell>
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "FAQPage",
        mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      }} />
      <section className="mx-auto max-w-[850px] px-6 pb-8 pt-6">
        <h1 className="font-serif text-[38px] leading-[1.1] tracking-[-1.5px] sm:text-[48px]">Questions and answers</h1>
        <p className="mt-5 text-lg leading-8 text-stone-600">Prices, deposits, the free trial and how it all works.</p>
      </section>
      <section className="mx-auto max-w-[850px] px-6 pb-16">
        <dl className="divide-y divide-[#dfe4d8] border-y border-[#dfe4d8]">
          {items.map((f) => (
            <div key={f.q} className="py-6"><dt className="font-semibold">{f.q}</dt><dd className="mt-2 text-sm leading-7 text-stone-600">{f.a}</dd></div>
          ))}
        </dl>
        <p className="mt-8 text-sm text-stone-600">Something else? Create a free account and use the Support page, or read about <Link href="/for" className="text-[#34553e] underline">who it is for</Link>.</p>
        <Link href="/signup" className={`${buttonClass} mt-6 bg-[#34553e] text-white hover:bg-[#25422e]`}>Start your free trial<Icon name="arrow" className="!h-4 !w-4" /></Link>
      </section>
    </MarketingShell>
  );
}
