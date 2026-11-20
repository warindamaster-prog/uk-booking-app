"use server";

import { headers } from "next/headers";
import { renderResetEmail } from "@/lib/auth-email";
import { clientIp, limiterKey } from "@/lib/booking/token";
import { publicEnv } from "@/lib/env";
import { zodState, type FormState } from "@/lib/form";
import { sendAccountEmail } from "@/lib/auth-mail";
import { createAdminClient } from "@/lib/supabase/admin";
import { forgotSchema } from "@/lib/validation/auth";

const SAME_ANSWER = "If that email has an account, we've sent a link to choose a new password. It can take a minute to arrive, so check your junk folder too.";

/**
 * Sends a password reset link from our own mailbox. The answer is the same whether or not the email has an
 * account, so this can't be used to find out who is registered. Rate limited per address and per visitor.
 */
export async function requestReset(_: FormState, formData: FormData): Promise<FormState> {
  const raw = { email: String(formData.get("email") ?? "") };
  const parsed = forgotSchema.safeParse(raw);
  if (!parsed.success) return zodState(parsed.error, { email: raw.email });

  const db = createAdminClient();
  const h = await headers();
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  for (const [key, limit] of [
    [limiterKey("forgot-ip", clientIp((n) => h.get(n)), secret), 8],
    [limiterKey("forgot-email", parsed.data.email, secret), 3],
  ] as const) {
    const hit = await db.rpc("rate_limit_hit", { p_key: key, p_window_seconds: 3600, p_limit: limit });
    if (hit.error) return { error: "Something went wrong. Please try again.", values: { email: raw.email } };
    if (!hit.data) return { error: "Too many attempts. Please wait a while and try again.", values: { email: raw.email } };
  }

  try {
    // generateLink only makes the one-time token: nothing is sent by Supabase, and an unknown email just errors.
    const { data, error } = await db.auth.admin.generateLink({ type: "recovery", email: parsed.data.email });
    const token = data?.properties?.hashed_token;
    if (!error && token) {
      const link = `${publicEnv().NEXT_PUBLIC_SITE_URL}/reset-password/confirm?token_hash=${encodeURIComponent(token)}`;
      await sendAccountEmail(parsed.data.email, renderResetEmail(link));
    }
  } catch (e) {
    console.error("password reset email failed", e instanceof Error ? e.message : e);
  }
  return { message: SAME_ANSWER, values: { email: raw.email } };
}
