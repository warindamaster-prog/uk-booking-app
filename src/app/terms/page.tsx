import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing/shell";
import { TERMS, TERMS_INTRO, TERMS_UPDATED } from "@/lib/terms";

export const metadata: Metadata = {
  title: "Terms of Service | Get It Book",
  description: "The terms for businesses using Get It Book: prices, free trial, refunds, deposits and data protection.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <MarketingShell>
      <article className="mx-auto w-full max-w-3xl px-6 pb-20 pt-4 lg:px-0">
        <h1 className="font-serif text-4xl tracking-[-1px] md:text-5xl">Terms of Service</h1>
        <p className="mt-3 text-sm text-stone-600">Last updated: {TERMS_UPDATED}</p>
        {TERMS_INTRO.map((t) => <p key={t} className="mt-5 leading-7 text-stone-700">{t}</p>)}
        {TERMS.map((s) => (
          <section key={s.h} className="mt-9">
            <h2 className="font-serif text-2xl">{s.h}</h2>
            {s.p?.map((t) => <p key={t} className="mt-3 leading-7 text-stone-700">{t}</p>)}
            {s.ul && <ul className="mt-3 list-disc space-y-2 pl-6 leading-7 text-stone-700">{s.ul.map((t) => <li key={t}>{t}</li>)}</ul>}
          </section>
        ))}
        <p className="mt-10 text-sm text-stone-600">See also our <Link className="underline" href="/privacy">Privacy notice</Link>.</p>
      </article>
    </MarketingShell>
  );
}
