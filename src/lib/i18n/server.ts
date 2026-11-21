import "server-only";
import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE, makeT, type Locale, type T } from "./core";

/** The language chosen with the EN / ไทย switch (a cookie on this device). English when nothing is chosen. */
export async function getLocale(): Promise<Locale> {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : "en";
}

export async function getT(): Promise<T> {
  return makeT(await getLocale());
}
