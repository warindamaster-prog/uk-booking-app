import { themeStyle } from "@/lib/theme";
import Link from "next/link";
import { DM_Sans } from "next/font/google";
import { formatPence } from "@/lib/money";
import { serif } from "@/lib/fonts";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });

const STEPS = ["Choose a service", "Date & time", "Your details"];

export type SummaryData = {
  serviceName?: string;
  minutes?: number;
  with?: string;
  when?: string;
  pricePence?: number;
  depositPence?: number;
};

export function PublicShell({ base, accent, name, logo, privacyUrl, step, summary, wide, children }: {
  base: string; accent?: string | null; name: string; logo: string | null; privacyUrl: string | null;
  /** 1-3 shows the progress bar; omit on pages outside the booking flow. */
  step?: 1 | 2 | 3;
  /** Shows the "Your booking" box next to the content. */
  summary?: SummaryData;
  /** The shop's front page uses the full width instead of the narrow column. */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`public-light ${sans.variable} ${serif.variable} [&_.font-serif]:font-[family-name:var(--font-dm-serif)] flex min-h-screen flex-col overflow-x-hidden bg-[color:var(--brand-bg,#f8f9f5)] font-[family-name:var(--font-dm-sans)] text-[color:var(--brand-ink,#243e32)] selection:bg-[color:var(--brand-soft,#d7eac2)]`} style={themeStyle(accent)}>
      <header className="border-b border-[color:var(--brand-line,#e3e8de)] bg-[#fffefa]">
        <div className="mx-auto flex min-h-20 max-w-[1100px] items-center justify-between gap-4 px-5 py-3 lg:px-8">
          <Link href={base || "/"} className="flex min-h-11 items-center gap-3">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" width={44} height={44} className="h-11 w-11 rounded-xl object-cover" />
            ) : (
              <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-xl bg-[color:var(--brand,#215b48)] text-lg font-semibold text-[color:var(--brand-on,#d6efbe)]">{name.trim().charAt(0).toUpperCase()}</span>
            )}
            <span className="text-xl font-bold tracking-tight text-[color:var(--brand-ink,#193e36)]">{name}</span>
          </Link>
          <p className="hidden items-center gap-2 text-xs text-[color:var(--brand-muted,#68766b)] sm:flex"><ShieldIcon />Simple. Secure. Booked.</p>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[1100px] flex-1 px-5 pb-14 pt-7 lg:px-8 lg:pt-9">
        {step && <Progress step={step} />}
        <div className={summary ? "grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10" : wide ? "" : "mx-auto max-w-2xl"}>
          <main className="min-w-0">{children}</main>
          {summary && <Summary name={name} data={summary} />}
        </div>
        {!wide && <p className="mt-12 border-t border-[color:var(--brand-line,#e0e6da)] pt-6 text-center text-sm text-[color:var(--brand-muted,#6b756d)]">
          You&apos;re booking directly with <span className="font-semibold text-[color:var(--brand-text,#36543c)]">{name}</span>
        </p>}
      </div>
      <footer className="border-t border-[color:var(--brand-line,#e2e7dc)] bg-[color:var(--brand-bg,#f1f3ed)] px-5 py-5 lg:px-8">
        <div className="mx-auto flex max-w-[1100px] flex-col items-center justify-between gap-2 text-xs text-[color:var(--brand-muted,#6b756d)] sm:flex-row">
          <p>Booking powered by Get It Book</p>
          {privacyUrl ? (
            <a href={privacyUrl} className="flex min-h-11 items-center underline" rel="noopener noreferrer">Privacy notice</a>
          ) : (
            <Link href="/privacy" className="flex min-h-11 items-center underline">Privacy notice</Link>
          )}
        </div>
      </footer>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-[color:var(--brand-text,#577e59)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" /><path d="m8 12 3 3 5-5" />
    </svg>
  );
}

function Progress({ step }: { step: 1 | 2 | 3 }) {
  return (
    <nav aria-label="Booking progress" className="mb-8">
      <ol className="flex flex-wrap items-center gap-x-4 gap-y-3 text-sm md:gap-x-6">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const current = n === step;
          const done = n < step;
          return (
            <li key={label} className="flex items-center gap-3" aria-current={current ? "step" : undefined}>
              {i > 0 && <span aria-hidden="true" className="mr-1 h-px w-5 bg-[color:var(--brand-line,#d5ddcf)] md:w-10" />}
              <span className={`flex items-center gap-2 ${current ? "font-semibold text-[color:var(--brand-text,#2d5941)]" : done ? "text-[color:var(--brand-text,#2d5941)]" : "text-[color:var(--brand-muted,#6b756d)]"}`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${current || done ? "bg-[color:var(--brand-text,#275d46)] text-white" : "border border-[color:var(--brand-line,#d9dfd4)] bg-white"}`}>{done ? "✓" : n}</span>
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Summary({ name, data }: { name: string; data: SummaryData }) {
  const has = Boolean(data.serviceName);
  return (
    <aside className="min-w-0 lg:sticky lg:top-8" aria-label="Your booking">
      <div className="overflow-hidden rounded-2xl border border-[color:var(--brand-line,#e0e5df)] bg-white shadow-[0_8px_35px_-20px_#23463430]">
        <div className="border-b border-[color:var(--brand-line,#edf0e9)] px-6 py-5">
          <h2 className="text-lg font-semibold tracking-tight">Your booking</h2>
          <p className="mt-1 text-sm text-[color:var(--brand-muted,#6b756d)]">With {name}</p>
        </div>
        <div className="p-6">
          {has ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{data.serviceName}</p>
                  {data.minutes != null && <p className="mt-1.5 text-xs text-[color:var(--brand-muted,#6b756d)]">{data.minutes} minutes</p>}
                  {data.with && <p className="mt-1 text-xs text-[color:var(--brand-muted,#6b756d)]">With {data.with}</p>}
                  {data.when && <p className="mt-1 text-xs font-medium text-[color:var(--brand-text,#2d5941)]">{data.when}</p>}
                </div>
                {data.pricePence != null && <p className="text-sm font-semibold">{formatPence(data.pricePence)}</p>}
              </div>
              <div className="my-5 border-t border-dashed border-[color:var(--brand-line,#dce2d8)]" />
              {data.pricePence != null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total</span>
                  <span className="text-2xl font-semibold tracking-tight">{formatPence(data.pricePence)}</span>
                </div>
              )}
              {data.depositPence != null && data.depositPence > 0 && data.pricePence != null && (
                <p className="mt-2 text-right text-xs text-[color:var(--brand-muted,#6b756d)]">
                  Pay {formatPence(data.depositPence)} deposit now
                  {data.pricePence > data.depositPence && <>, {formatPence(data.pricePence - data.depositPence)} at the appointment</>}
                </p>
              )}
            </>
          ) : (
            <p className="rounded-lg bg-[color:var(--brand-bg,#f7f8f4)] p-4 text-sm leading-6 text-[color:var(--brand-muted,#69756c)]">Select a service to start your booking.</p>
          )}
        </div>
      </div>
    </aside>
  );
}
