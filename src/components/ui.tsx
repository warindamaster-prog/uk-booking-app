"use client";

import { useT } from "@/lib/i18n/client";
import Link from "next/link";
import { LanguageSwitch } from "@/components/language-switch";
import { sans, serif } from "@/lib/fonts";
import type { InputHTMLAttributes, ReactNode } from "react";

export function Field({
  label, name, errors, hint, id: idProp, ...props
}: { label: string; name: string; errors?: string[]; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const t = useT();
  const id = idProp ?? name; // pass `id` when the same field name appears more than once on a page
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = errors?.length ? `${id}-error` : undefined;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-[#2d4a38] dark:text-inherit">{t(label)}</label>
      <input
        id={id}
        name={name}
        aria-invalid={errId ? true : undefined}
        aria-describedby={[hintId, errId].filter(Boolean).join(" ") || undefined}
        className="block min-h-12 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base text-[#24392e] outline-none transition placeholder:text-stone-400 focus:border-[#34553e] focus:ring-2 focus:ring-[#397451]/40 aria-[invalid=true]:border-red-600 file:mr-3 file:rounded-md file:border-0 file:bg-[#eef3e9] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[#34553e]"
        {...props}
      />
      {hint && <p id={hintId} className="text-sm text-[#6b756d]">{t(hint)}</p>}
      {errId && <p id={errId} className="text-sm text-red-700 dark:text-red-400">{t(errors![0])}</p>}
    </div>
  );
}

export function SubmitButton({ children, pending }: { children: ReactNode; pending?: boolean }) {
  const t = useT();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-12 w-full rounded-lg bg-[#34553e] px-4 py-3 text-base font-semibold text-white transition hover:bg-[#25422e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#397451] focus-visible:ring-offset-2 disabled:opacity-60"
    >
      {pending ? t("Please wait…") : typeof children === "string" ? t(children) : children}
    </button>
  );
}

export function FormError({ message }: { message?: string }) {
  const t = useT();
  if (!message) return null;
  return <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{t(message)}</p>;
}

export function Shell({ title, children }: { title: string; children: ReactNode }) {
  const t = useT();
  return (
    <div
      className={`public-light ${sans.variable} ${serif.variable} flex min-h-screen flex-col bg-[#fafbf7] text-[#24392e] selection:bg-[#d5e4c7] [&_a.underline]:text-[#215b48]`}
      style={{ fontFamily: "var(--font-dm-sans), Arial, Helvetica, var(--font-thai), sans-serif" }}
    >
      <header className="mx-auto flex h-20 w-full max-w-[1280px] items-center justify-between gap-5 px-6 lg:px-12">
        <Link href="/" aria-label="WP Booking home" className="flex min-h-11 items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#34553e] text-white">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 11h18m-12 4h2m3 0h2" /></svg>
          </span>
          <span className="text-xl font-semibold tracking-[-0.8px]">wp<span className="font-normal">booking</span><span className="text-[#6a815c]">.</span></span>
        </Link>
        <LanguageSwitch />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-4 sm:pt-8">
        <div className="w-full max-w-md rounded-2xl border border-white bg-white p-6 shadow-[0_24px_70px_-30px_#34453655] sm:p-8">
          <h1 className="mb-6 text-[32px] leading-tight tracking-[-1px]" style={{ fontFamily: "var(--font-dm-serif), Georgia, var(--font-thai), serif" }}>{t(title)}</h1>
          {children}
        </div>
      </main>
      <footer className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-4 border-t border-[#e1e6d9] px-6 py-5 text-xs text-[#6b756d] lg:px-12">
        <p>© {new Date().getFullYear()} WP Precision Systems</p>
        <Link href="/privacy" className="flex min-h-11 items-center hover:underline">{t("Privacy")}</Link>
      </footer>
    </div>
  );
}
