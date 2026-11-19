"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { computeSlots } from "@/lib/availability";
import { requireBusiness } from "@/lib/auth";
import { loadBookingContext } from "@/lib/booking/data";
import type { FormState } from "@/lib/form";
import { todayYmd } from "@/lib/time";
import { uuid } from "@/lib/validation/catalog";
import { z } from "zod";

const GENERIC = "Something went wrong. Please try again.";
const NOT_ALLOWED = "This booking can't be changed that way. It may have already been updated, so refresh the page.";

function refresh(id: string) {
  revalidatePath(`/dashboard/bookings/${id}`);
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard");
}

async function setStatus(formData: FormData, patch: { status: string; cancelled_by?: string }, done: string): Promise<FormState> {
  const { supabase, business } = await requireBusiness();
  const id = uuid.safeParse(String(formData.get("id") ?? ""));
  if (!id.success) return { error: GENERIC };

  // RLS limits this to the owner's bookings, or a staff member's own. The database trigger
  // decides whether the status change itself is allowed.
  const { data, error } = await supabase.from("bookings").update(patch)
    .eq("id", id.data).eq("business_id", business.id).select("id").maybeSingle();
  if (error) return { error: error.message?.includes("invalid_booking") ? NOT_ALLOWED : GENERIC };
  if (!data) return { error: "We couldn't find that booking." };
  refresh(id.data);
  return { message: done };
}

export async function cancelBooking(_: FormState, formData: FormData): Promise<FormState> {
  // Step 6 (emails): send the customer a cancellation notice here.
  // Step 7 (Stripe): refund a paid deposit when the business cancels.
  return setStatus(formData, { status: "cancelled", cancelled_by: "business" }, "Booking cancelled. The time is free again.");
}
export const markNoShow = async (_: FormState, formData: FormData) => setStatus(formData, { status: "no_show" }, "Marked as a no-show.");
export const undoNoShow = async (_: FormState, formData: FormData) => setStatus(formData, { status: "confirmed" }, "No-show removed.");

const rescheduleSchema = z.object({ id: z.uuid(), staff: z.uuid(), startsAt: z.iso.datetime() });

export async function rescheduleBooking(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, business, role } = await requireBusiness();
  const parsed = rescheduleSchema.safeParse({
    id: String(formData.get("id") ?? ""), staff: String(formData.get("staff") ?? ""), startsAt: String(formData.get("startsAt") ?? ""),
  });
  if (!parsed.success) return { error: "Choose a time first." };
  const { id, staff, startsAt } = parsed.data;

  const { data: booking } = await supabase.from("bookings")
    .select("id, staff_id, service_id, status, starts_at, duration_minutes, buffer_before_minutes, buffer_after_minutes")
    .eq("id", id).eq("business_id", business.id).maybeSingle();
  if (!booking) return { error: "We couldn't find that booking." };
  if (role === "staff" && staff !== booking.staff_id) return { error: NOT_ALLOWED };

  // Re-check the new time on the server. The booking itself is left out of the busy times.
  const start = new Date(startsAt);
  const date = todayYmd(business.timezone, start);
  const ctx = await loadBookingContext(business, booking.service_id, staff, date, 1, new Date(), {
    db: supabase, excludeBookingId: booking.id, minNoticeMinutes: 0, maxAdvanceDays: 365, allowInactiveService: true,
  });
  if (!ctx) return { error: GENERIC };
  const base = { ...ctx.base, service: { // the booking keeps the duration and buffers it was made with
    durationMinutes: booking.duration_minutes, bufferBeforeMinutes: booking.buffer_before_minutes, bufferAfterMinutes: booking.buffer_after_minutes } };
  const slot = computeSlots({ ...base, date }).find((s) => s.start.getTime() === start.getTime());
  if (!slot || !slot.staffIds.includes(staff)) return { error: "That time isn't free any more. Please choose another." };

  const { data, error } = await supabase.from("bookings").update({
    staff_id: staff, starts_at: start.toISOString(), ends_at: slot.end.toISOString(),
  }).eq("id", booking.id).eq("business_id", business.id).select("id").maybeSingle();
  if (error) {
    if (error.code === "23P01") return { error: "That time has just been taken. Please choose another." };
    return { error: error.message?.includes("invalid_booking") ? NOT_ALLOWED : GENERIC };
  }
  if (!data) return { error: NOT_ALLOWED };

  // Step 6 (emails): tell the customer their booking has moved.
  refresh(booking.id);
  redirect(`/dashboard/bookings/${booking.id}?moved=1`);
}
