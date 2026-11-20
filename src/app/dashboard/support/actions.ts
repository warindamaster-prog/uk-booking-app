"use server";

import { requireBusiness } from "@/lib/auth";
import { clientIp, limiterKey } from "@/lib/booking/token";
import { zodState, type FormState } from "@/lib/form";
import { createMailers } from "@/lib/notifications/resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderSupportEmail, supportInbox, supportSchema } from "@/lib/support";
import { headers } from "next/headers";

/** Emails the message to our team. Reply-To is the shop's address, so answering the email answers the shop. */
export async function sendSupportMessage(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user, business, role } = await requireBusiness();
  const raw = {
    topic: String(formData.get("topic") ?? ""), message: String(formData.get("message") ?? ""), replyTo: String(formData.get("replyTo") ?? ""),
  };
  const parsed = supportSchema.safeParse(raw);
  if (!parsed.success) return zodState(parsed.error, raw);

  const db = createAdminClient();
  const h = await headers();
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  for (const [key, limit] of [
    [limiterKey("support-shop", business.id, secret), 5],
    [limiterKey("support-ip", clientIp((n) => h.get(n)), secret), 15],
  ] as const) {
    const hit = await db.rpc("rate_limit_hit", { p_key: key, p_window_seconds: 3600, p_limit: limit });
    if (hit.error) return { error: "Something went wrong. Please try again.", values: raw };
    if (!hit.data) return { error: "You've sent several messages in the last hour. Please wait a little, or email us directly.", values: raw };
  }

  const { data: billing } = role === "owner"
    ? await supabase.from("business_billing").select("status").eq("business_id", business.id).maybeSingle()
    : { data: null };

  try {
    const mailers = createMailers();
    const from = mailers.fromAddress("business");
    await mailers.provider("business").send({
      from: `"Shop support" <${from}>`,
      to: supportInbox(process.env, from),
      replyTo: parsed.data.replyTo,
      ...renderSupportEmail({
        shopName: business.name, shopSlug: business.slug, businessId: business.id, userEmail: user.email ?? "", role,
        billingStatus: billing?.status ?? null, ...parsed.data,
      }),
      idempotencyKey: `support:${business.id}:${Date.now()}`,
    });
  } catch (e) {
    console.error("support email failed", e instanceof Error ? e.message : e);
    return { error: "We couldn't send your message. Please try again in a minute.", values: raw };
  }
  return { message: "Thanks, your message is with our team. We'll reply by email, usually within one working day.", values: { topic: raw.topic, message: "", replyTo: raw.replyTo } };
}
