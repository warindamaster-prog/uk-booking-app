"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import type { FormState } from "@/lib/form";
import { isValidSeats, PRICING } from "@/lib/pricing";

export async function updateSeats(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, business } = await requireOwner();
  const text = String(formData.get("seats") ?? "").trim();
  const seats = /^\d+$/.test(text) ? Number(text) : NaN;
  if (!isValidSeats(seats)) {
    return { fieldErrors: { seats: [`Enter a number from ${PRICING.minSeats} to ${PRICING.maxSeats}`] }, values: { seats: text } };
  }

  const { error } = await supabase.rpc("change_staff_seats", { p_business_id: business.id, p_new_seats: seats });
  if (error) {
    const m = error.message ?? "";
    if (m.includes("staff_seats_below_active")) {
      return { error: `${m.split(": ")[1] ?? "Some team members are active"}. Set people to "not taking bookings" first, then lower the number.`, values: { seats: text } };
    }
    if (m.includes("seat_increase_requires_payment")) {
      return { error: "Adding team members on a paid plan will be available when billing launches.", values: { seats: text } };
    }
    return { error: "Something went wrong. Please try again.", values: { seats: text } };
  }
  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard/staff");
  return { message: "Saved.", values: { seats: text } };
}
