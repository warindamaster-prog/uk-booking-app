"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isLocale, LOCALE_COOKIE } from "./core";

/** Sets the language for this device and returns to the page the visitor was on. */
export async function setLocale(formData: FormData) {
  const locale = String(formData.get("locale") ?? "");
  const back = String(formData.get("path") ?? "/");
  if (isLocale(locale)) {
    (await cookies()).set(LOCALE_COOKIE, locale, { maxAge: 60 * 60 * 24 * 365, path: "/", sameSite: "lax", httpOnly: false });
  }
  // Only ever go back to a path on this site.
  redirect(back.startsWith("/") && !back.startsWith("//") ? back : "/");
}
