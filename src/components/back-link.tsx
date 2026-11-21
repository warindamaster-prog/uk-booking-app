import Link from "next/link";

/** "Back to ..." as a proper button with an arrow, used at the top of the dashboard detail pages. `label` is already translated and may start with "← ". */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <p>
      <Link href={href}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#dfe5da] bg-white px-4 text-sm font-medium text-[#415044] transition hover:bg-[#f1f5ed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#397451]">
        <svg className="h-4 w-4 shrink-0 rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
        {label.replace(/^←\s*/, "")}
      </Link>
    </p>
  );
}
