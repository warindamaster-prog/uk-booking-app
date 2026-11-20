"use server";

import { redirect } from "next/navigation";
import { TOKEN_HASH_RE } from "@/lib/auth-email";
import { createClient } from "@/lib/supabase/server";

/** The button on the confirm page: only now is the one-time token used, so mail scanners can't use it up. */
export async function confirmReset(formData: FormData): Promise<void> {
  const tokenHash = String(formData.get("token_hash") ?? "");
  if (!TOKEN_HASH_RE.test(tokenHash)) redirect("/forgot-password?error=expired");
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
  if (error) redirect("/forgot-password?error=expired");
  redirect("/reset-password");
}
