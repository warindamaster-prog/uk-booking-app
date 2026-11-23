import Link from "next/link";
import { BrandLogo } from "@/components/brand";
import { sans, serif } from "@/lib/fonts";
import { BUSINESS_PAGES } from "@/lib/seo-pages";
import { Icon, buttonClass } from "@/components/landing/icon";

/** The frame of the pages written for search engines: the landing page's look, a simple header and a footer with links to every page. */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${sans.variable} ${serif.variable} flex min-h-screen flex-col overflow-x-hidden bg-[#fafbf7] font-[family-name:var(--font-dm-sans)] text-[#24392e] selection:bg-[#d5e4c7] [&_.font-serif]:font-[family-name:var(--font-dm-serif)]`}>
      <header className="mx-auto flex h-24 w-full max-w-[1280px] items-center justify-between gap-5 px-6 lg:px-12">
        <BrandLogo />
        <nav aria-label="Main navigation" className="flex items-center gap-3 md:gap-8">
          <Link href="/for" className="hidden py-3 text-sm text-stone-600 hover:text-[#34553e] md:block">Who it&apos;s for</Link>
          <Link href="/faq" className="hidden py-3 text-sm text-stone-600 hover:text-[#34553e] md:block">Questions</Link>
          <Link href="/login" className="hidden py-3 text-sm text-stone-600 hover:text-[#34553e] sm:block">Log in</Link>
          <Link href="/signup" className={`${buttonClass} bg-[#34553e] text-white hover:bg-[#25422e]`}>Get started<Icon name="arrow" className="!h-4 !w-4" /></Link>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-[#e1e6d9] px-6 py-10 text-sm text-stone-600 lg:px-12">
        <div className="mx-auto grid max-w-[1280px] gap-8 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <p className="font-semibold text-[#24392e]">Get It Book</p>
            <p className="mt-2 max-w-xs leading-6">Online booking for UK businesses. A flat monthly fee and no commission on your bookings.</p>
          </div>
          <div>
            <p className="font-semibold text-[#24392e]">Who it&apos;s for</p>
            <ul className="mt-2 space-y-1">{BUSINESS_PAGES.map((p) => <li key={p.slug}><Link className="hover:underline" href={`/for/${p.slug}`}>{p.label}</Link></li>)}</ul>
          </div>
          <div>
            <p className="font-semibold text-[#24392e]">More</p>
            <ul className="mt-2 space-y-1">
              <li><Link className="hover:underline" href="/">Home and prices</Link></li>
              <li><Link className="hover:underline" href="/faq">Questions and answers</Link></li>
              <li><Link className="hover:underline" href="/terms">Terms of Service</Link></li>
              <li><Link className="hover:underline" href="/privacy">Privacy notice</Link></li>
              <li><Link className="hover:underline" href="/login">Log in</Link></li>
            </ul>
          </div>
        </div>
        <p className="mx-auto mt-8 max-w-[1280px] text-xs">© {new Date().getFullYear()} WP Precision Systems. Built for better business.</p>
      </footer>
    </div>
  );
}

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
