"use server";

import { redirect } from "next/navigation";
import { TOKEN_HASH_RE } from "@/lib/auth-email";
import { createClient } from "@/lib/supabase/server";

/** The button on the confirm page: only now is the one-time token used, so mail scanners can't use it up. */
export async function confirmSignup(formData: FormData): Promise<void> {
  const tokenHash = String(formData.get("token_hash") ?? "");
  if (!TOKEN_HASH_RE.test(tokenHash)) redirect("/login");
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: "signup", token_hash: tokenHash });
  if (error) redirect("/login"); // already confirmed, or the link expired: logging in is the way forward
  redirect("/onboarding");
}
