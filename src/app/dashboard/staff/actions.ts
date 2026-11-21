"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireBusiness, requireOwner } from "@/lib/auth";
import { zodState, type FormState } from "@/lib/form";
import { DEFAULT_WORKING_HOURS, parseWeeklyHours } from "@/lib/hours";
import { addDaysYmd, localMidnightUtc } from "@/lib/time";
import { staffSchema, timeOffSchema, uuid } from "@/lib/validation/catalog";

const GENERIC = "Something went wrong. Please try again.";
const SEATS_FULL = "All your team seats are in use. Increase your team size on the Billing page, or set someone else to not take bookings.";
const SEATS_FULL_REDUCTION = "You have planned a reduction in team size for your next billing period, so only the lower number of people can take bookings. To add someone now, go to Billing and choose \"Keep my current plan instead\", or set someone else to not take bookings.";
const isSeatLimit = (e: { message?: string } | null) => !!e?.message?.includes("staff_seats_exceeded");

/** Why the seat limit was hit: a planned reduction is the confusing case, so say so. */
async function seatsFullMessage(supabase: Awaited<ReturnType<typeof requireOwner>>["supabase"], businessId: string): Promise<string> {
  const { data } = await supabase.from("business_billing").select("staff_seats, next_staff_seats").eq("business_id", businessId).maybeSingle();
  return data && data.next_staff_seats !== null && data.next_staff_seats < data.staff_seats ? SEATS_FULL_REDUCTION : SEATS_FULL;
}

export async function saveStaff(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, business } = await requireOwner();
  const raw = {
    name: String(formData.get("name") ?? ""), email: String(formData.get("email") ?? ""),
    description: String(formData.get("description") ?? ""), levelId: String(formData.get("levelId") ?? ""),
  };
  const active = formData.get("active") === "on";
  const idRaw = String(formData.get("id") ?? "");
  const id = idRaw ? uuid.safeParse(idRaw) : null;
  if (id && !id.success) return { error: "That team member could not be found." };

  const parsed = staffSchema.safeParse({ ...raw, active });
  if (!parsed.success) return zodState(parsed.error, { ...raw, active: active ? "on" : "" });
  const row = {
    name: parsed.data.name, email: parsed.data.email, active: parsed.data.active,
    description: parsed.data.description, level_id: parsed.data.levelId,
  };

  if (id?.success) {
    const { error } = await supabase.from("staff").update(row).eq("id", id.data).eq("business_id", business.id);
    if (error) return { error: isSeatLimit(error) ? await seatsFullMessage(supabase, business.id) : GENERIC, values: { ...raw, active: active ? "on" : "" } };
    revalidatePath(`/dashboard/staff/${id.data}`);
    return { message: "Saved." , values: { ...raw, active: active ? "on" : "" } };
  }
  const { data, error } = await supabase.from("staff").insert({ ...row, business_id: business.id }).select("id").single();
  if (error || !data) return { error: isSeatLimit(error) ? await seatsFullMessage(supabase, business.id) : GENERIC, values: { ...raw, active: active ? "on" : "" } };
  // A new team member starts with 08:00 to 17:00 every day so they can take bookings straight away.
  // Best effort: if this fails the owner just sees an empty hours form and sets the hours there.
  await supabase.rpc("set_working_hours", {
    p_staff_id: data.id,
    p_hours: DEFAULT_WORKING_HOURS.map((h) => ({ weekday: h.weekday, start: h.start, end: h.end })),
  });
  redirect(`/dashboard/staff/${data.id}`);
}

export async function saveStaffServices(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireOwner();
  const staffId = uuid.safeParse(String(formData.get("staffId") ?? ""));
  const ids = formData.getAll("service").map(String);
  const serviceIds = ids.map((s) => uuid.safeParse(s));
  if (!staffId.success || serviceIds.some((r) => !r.success)) return { error: GENERIC };

  const { error } = await supabase.rpc("set_staff_services", {
    p_staff_id: staffId.data,
    p_service_ids: serviceIds.map((r) => r.data as string),
  });
  if (error) return { error: GENERIC };
  revalidatePath(`/dashboard/staff/${staffId.data}`);
  return { message: "Saved." };
}

export async function saveHours(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireBusiness(); // RLS: owner, or the staff member themselves
  const staffId = uuid.safeParse(String(formData.get("staffId") ?? ""));
  if (!staffId.success) return { error: GENERIC };

  const result = parseWeeklyHours((k) => String(formData.get(k) ?? ""));
  if (!result.ok) {
    const fieldErrors: Record<string, string[]> = {};
    for (const [day, msg] of Object.entries(result.errors)) fieldErrors[`day-${day}`] = [msg];
    return { error: "Please fix the highlighted days.", fieldErrors };
  }

  const { error } = await supabase.rpc("set_working_hours", {
    p_staff_id: staffId.data,
    p_hours: result.hours.map((h) => ({ weekday: h.weekday, start: h.start, end: h.end })),
  });
  if (error) return { error: GENERIC };
  revalidatePath(`/dashboard/staff/${staffId.data}`);
  return { message: "Working hours saved." };
}

export async function addTimeOff(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireBusiness();
  const staffId = uuid.safeParse(String(formData.get("staffId") ?? ""));
  if (!staffId.success) return { error: GENERIC };

  const raw = {
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  };
  const parsed = timeOffSchema.safeParse(raw);
  if (!parsed.success) return zodState(parsed.error, raw);

  // The staff row is RLS-filtered, so this also proves the caller may see this member.
  const { data: staff } = await supabase.from("staff").select("id, business_id").eq("id", staffId.data).maybeSingle();
  if (!staff) return { error: GENERIC, values: raw };

  const { error } = await supabase.from("time_off").insert({
    business_id: staff.business_id,
    staff_id: staff.id,
    // Whole days in UK time: from local midnight to local midnight after the last day.
    starts_at: localMidnightUtc(parsed.data.startDate).toISOString(),
    ends_at: localMidnightUtc(addDaysYmd(parsed.data.endDate, 1)).toISOString(),
    reason: parsed.data.reason,
  });
  if (error) return { error: GENERIC, values: raw };
  revalidatePath(`/dashboard/staff/${staffId.data}`);
  return { message: "Days off added." };
}

export async function deleteTimeOff(formData: FormData): Promise<void> {
  const { supabase } = await requireBusiness();
  const id = uuid.safeParse(String(formData.get("id") ?? ""));
  const staffId = uuid.safeParse(String(formData.get("staffId") ?? ""));
  if (!id.success || !staffId.success) return;
  await supabase.from("time_off").delete().eq("id", id.data).eq("staff_id", staffId.data);
  revalidatePath(`/dashboard/staff/${staffId.data}`);
}

export async function deleteStaff(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireOwner();
  const id = uuid.safeParse(String(formData.get("staffId") ?? ""));
  if (!id.success) return { error: "That team member could not be found." };
  const { error } = await supabase.rpc("delete_staff", { p_staff_id: id.data });
  if (error) {
    if (error.message.includes("staff_has_upcoming_bookings")) {
      return { error: "This person still has upcoming bookings. Move or cancel them first, then try again." };
    }
    return { error: GENERIC };
  }
  revalidatePath("/dashboard/staff");
  redirect("/dashboard/staff");
}
