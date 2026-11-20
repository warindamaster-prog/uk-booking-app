"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { renderConfirmEmail, renderExistingAccountEmail } from "@/lib/auth-email";
import { sendAccountEmail } from "@/lib/auth-mail";
import { clientIp, limiterKey } from "@/lib/booking/token";
import { publicEnv } from "@/lib/env";
import { zodState, type FormState } from "@/lib/form";
import { createAdminClient } from "@/lib/supabase/admin";
import { signupSchema } from "@/lib/validation/auth";

const GENERIC = "We couldn't create that account. Try a different email or password.";

/**
 * Creates the account and emails the confirmation link from OUR mailbox. Supabase's own email service is
 * limited to a few messages an hour for the whole project, which is far too few for real sign-ups.
 * If the email already has an account we say nothing on screen (so sign-up can't be used to find out who
 * is registered) and email that person instead.
 */
export async function signup(_: FormState, formData: FormData): Promise<FormState> {
  const raw = { email: String(formData.get("email") ?? ""), password: String(formData.get("password") ?? "") };
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) return zodState(parsed.error, { email: raw.email });

  const db = createAdminClient();
  const h = await headers();
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  for (const [key, limit] of [
    [limiterKey("signup-ip", clientIp((n) => h.get(n)), secret), 10],
    [limiterKey("signup-email", parsed.data.email, secret), 5],
  ] as const) {
    const hit = await db.rpc("rate_limit_hit", { p_key: key, p_window_seconds: 3600, p_limit: limit });
    if (hit.error) return { error: GENERIC, values: { email: raw.email } };
    if (!hit.data) return { error: "Too many attempts. Please wait a while and try again.", values: { email: raw.email } };
  }

  const site = publicEnv().NEXT_PUBLIC_SITE_URL;
  // generateLink creates the (unconfirmed) account and the one-time token, and sends nothing itself.
  const { data, error } = await db.auth.admin.generateLink({ type: "signup", email: parsed.data.email, password: parsed.data.password });

  if (error) {
    if (error.code === "email_exists") {
      try { await sendAccountEmail(parsed.data.email, renderExistingAccountEmail(`${site}/login`, `${site}/forgot-password`)); }
      catch (e) { console.error("existing-account email failed", e instanceof Error ? e.message : e); }
      redirect("/signup/check-email");
    }
    if (error.code === "weak_password") return { error: "That password is too easy to guess. Choose a longer or less common one.", values: { email: raw.email } };
    console.error("signup failed", error.code, error.message);
    return { error: GENERIC, values: { email: raw.email } };
  }

  const token = data?.properties?.hashed_token;
  if (!token || !data.user) return { error: GENERIC, values: { email: raw.email } };
  try {
    await sendAccountEmail(parsed.data.email, renderConfirmEmail(`${site}/signup/confirm?token_hash=${encodeURIComponent(token)}`));
  } catch (e) {
    console.error("confirmation email failed", e instanceof Error ? e.message : e);
    await db.auth.admin.deleteUser(data.user.id); // so they can simply try again
    return { error: "We couldn't send your confirmation email just now. Please try again in a few minutes.", values: { email: raw.email } };
  }
  redirect("/signup/check-email");
}
