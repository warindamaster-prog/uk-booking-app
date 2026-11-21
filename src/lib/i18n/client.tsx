"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { makeT, type Locale, type T } from "./core";

const LocaleContext = createContext<Locale>("en");

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export const useLocale = (): Locale => useContext(LocaleContext);

/** For client components. Server components use `await getT()` from ./server. */
export function useT(): T {
  const locale = useLocale();
  return useMemo(() => makeT(locale), [locale]);
}
