"use server";

import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { refundPrepaidPlan } from "@/lib/stripe/prepaid-refund-service";

export async function refundPrepaid(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const id = String(formData.get("businessId") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id) || formData.get("confirm") !== "on") redirect("/admin/refunds?error=" + encodeURIComponent("Tick the box to confirm."));
  let message: string;
  try {
    message = await refundPrepaidPlan(id);
  } catch (e) {
    redirect("/admin/refunds?error=" + encodeURIComponent(e instanceof Error ? e.message : "Something went wrong."));
  }
  redirect("/admin/refunds?done=" + encodeURIComponent(message));
}
