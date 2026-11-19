"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getBusinessBySlug } from "@/lib/booking/data";
import { byteaParam, clientIp, hashToken, limiterKey, TOKEN_RE } from "@/lib/booking/token";
import type { FormState } from "@/lib/form";
import { notifyBookingEvent } from "@/lib/notifications/service";
import { settleDeposit } from "@/lib/stripe/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { SLUG_RE } from "@/lib/slug";

const GENERIC = "Something went wrong. Please try again.";

/** Customer cancels with their private link. The database enforces the cancellation window. */
export async function cancelMyBooking(_: FormState, formData: FormData): Promise<FormState> {
  const slug = String(formData.get("slug") ?? "");
  const token = String(formData.get("token") ?? "");
  if (!SLUG_RE.test(slug) || !TOKEN_RE.test(token)) return { error: GENERIC };

  const db = createAdminClient();
  const h = await headers();
  const limit = await db.rpc("rate_limit_hit", {
    p_key: limiterKey("cancel-ip", clientIp((n) => h.get(n)), process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""),
    p_window_seconds: 600, p_limit: 10,
  });
  if (limit.error) return { error: GENERIC };
  if (!limit.data) return { error: "Too many attempts. Please wait a little while and try again." };

  const business = await getBusinessBySlug(slug);
  if (!business) return { error: GENERIC };
  const hash = byteaParam(hashToken(token));
  // The link only works on its own business's page.
  const { data: own } = await db.from("bookings").select("id").eq("cancel_token_hash", hash).eq("business_id", business.id).maybeSingle();
  if (!own) return { error: GENERIC };

  const { data: id, error } = await db.rpc("customer_cancel_booking", { p_token_hash: hash });
  if (error) {
    const m = error.message ?? "";
    if (m.includes("cancellation_window_closed")) {
      return { error: `Online cancellation has closed. Please reply to your confirmation email or contact ${business.name} directly.` };
    }
    if (m.includes("can no longer be cancelled")) return { error: "This booking has already been cancelled or can't be changed." };
    return { error: GENERIC };
  }

  // Customers who cancel before the window get any deposit back; the email says so once it is done.
  after(async () => {
    await settleDeposit(db, String(id), "customer");
    await notifyBookingEvent(String(id), "cancellation");
  });
  revalidatePath(`/b/${slug}/booking/${token}`);
  return { message: "Your booking has been cancelled." };
}
