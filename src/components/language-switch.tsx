"use client";

import { usePathname } from "next/navigation";
import { setLocale } from "@/lib/i18n/actions";
import { useLocale } from "@/lib/i18n/client";

/** EN | ไทย. Plain buttons in a form, so it works without scripts and is easy to tap. */
export function LanguageSwitch() {
  const locale = useLocale();
  const path = usePathname() || "/";
  const btn = (value: "en" | "th", label: string, lang: string) => (
    <button type="submit" name="locale" value={value} lang={lang} aria-pressed={locale === value}
      className={`min-h-9 rounded px-2 text-sm ${locale === value ? "font-semibold underline underline-offset-4" : "opacity-70"}`}>{label}</button>
  );
  return (
    <form action={setLocale} className="inline-flex items-center gap-1" aria-label="Language">
      <input type="hidden" name="path" value={path} />
      {btn("en", "EN", "en")}
      <span aria-hidden="true">|</span>
      {btn("th", "ไทย", "th")}
    </form>
  );
}
