import Link from "next/link";

/** The Get It Book logo: a calendar with a tick, and the name set in the sans and serif of the landing page. Needs the DM Sans/Serif font variables on a parent. */
export function BrandLogo({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    <Link href={href} aria-label="Get It Book home" className={`group flex min-h-11 items-center gap-2.5 ${className}`}>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#34553e] text-[#e9f2d9] shadow-[0_6px_16px_-8px_#34553e] transition group-hover:bg-[#2a4731]">
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="3.5" />
          <path d="M7.5 3v4m9-4v4M3 10.5h18" />
          <path d="m8.6 15.6 2.3 2.3 4.6-4.7" />
        </svg>
      </span>
      <span className="whitespace-nowrap text-[22px] leading-none tracking-[-0.6px] text-[#24392e]">
        <span className="font-semibold">Get It</span>{" "}
        <span className="italic text-[#6a815c]" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif", letterSpacing: "-0.3px" }}>Book</span>
      </span>
    </Link>
  );
}
