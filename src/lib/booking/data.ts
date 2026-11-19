import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { dayBounds, type AvailabilityQuery, type StaffDay } from "@/lib/availability";
import { addDaysYmd } from "@/lib/time";
import { blockedInterval, isLive, type LiveBookingRow } from "./slots";

// Everything here uses the service-role client, which bypasses RLS. Every query is
// therefore scoped by business_id explicitly, and only public-safe columns are returned.

export type PublicBusiness = {
  id: string; name: string; slug: string; timezone: string; logo_path: string | null;
  slot_interval_minutes: number; min_notice_minutes: number; max_advance_days: number;
  privacy_notice_url: string | null; subscription_status: string; stripe_charges_enabled: boolean;
  cancellation_window_hours: number;
};

export type PublicService = {
  id: string; name: string; description: string | null; duration_minutes: number;
  buffer_before_minutes: number; buffer_after_minutes: number; price_pence: number; deposit_pence: number;
};

const ACCEPTING = new Set(["trialing", "active", "past_due"]);
export const acceptsBookings = (b: Pick<PublicBusiness, "subscription_status">) => ACCEPTING.has(b.subscription_status);

export async function getBusinessBySlug(slug: string): Promise<PublicBusiness | null> {
  const { data } = await createAdminClient().from("businesses")
    .select("id, name, slug, timezone, logo_path, slot_interval_minutes, min_notice_minutes, max_advance_days, privacy_notice_url, subscription_status, stripe_charges_enabled, cancellation_window_hours")
    .eq("slug", slug).maybeSingle();
  return (data as PublicBusiness | null) ?? null;
}

export function logoUrl(path: string | null): string | null {
  if (!path) return null;
  return createAdminClient().storage.from("logos").getPublicUrl(path).data.publicUrl;
}

/** Active services that at least one active staff member offers. */
export async function listBookableServices(businessId: string): Promise<PublicService[]> {
  const db = createAdminClient();
  const [services, links, staff] = await Promise.all([
    db.from("services").select("id, name, description, duration_minutes, buffer_before_minutes, buffer_after_minutes, price_pence, deposit_pence")
      .eq("business_id", businessId).eq("active", true).order("sort_order").order("name"),
    db.from("staff_services").select("service_id, staff_id").eq("business_id", businessId),
    db.from("staff").select("id").eq("business_id", businessId).eq("active", true),
  ]);
  const activeStaff = new Set((staff.data ?? []).map((s) => s.id));
  const offered = new Set((links.data ?? []).filter((l) => activeStaff.has(l.staff_id)).map((l) => l.service_id));
  return ((services.data ?? []) as PublicService[]).filter((s) => offered.has(s.id));
}

export type BookingContext = {
  service: PublicService;
  staffOptions: { id: string; name: string }[];
  /** Ready for computeSlots / findAvailableDates (add `date` for the former). */
  base: Omit<AvailabilityQuery, "date">;
};

/**
 * Loads everything the availability engine needs for `days` days from `fromYmd`.
 * `staffChoice` is "any" or one staff id. Returns null if the service or staff isn't bookable.
 */
export async function loadBookingContext(
  business: PublicBusiness, serviceId: string, staffChoice: "any" | string,
  fromYmd: string, days: number, now: Date = new Date(),
): Promise<BookingContext | null> {
  const db = createAdminClient();
  const { data: service } = await db.from("services")
    .select("id, name, description, duration_minutes, buffer_before_minutes, buffer_after_minutes, price_pence, deposit_pence")
    .eq("id", serviceId).eq("business_id", business.id).eq("active", true).maybeSingle();
  if (!service) return null;

  const { data: links } = await db.from("staff_services").select("staff_id").eq("business_id", business.id).eq("service_id", serviceId);
  const offeredBy = (links ?? []).map((l) => l.staff_id);
  if (!offeredBy.length) return null;

  const { data: staffRows } = await db.from("staff").select("id, name").eq("business_id", business.id).eq("active", true)
    .in("id", offeredBy).order("sort_order").order("name");
  const staffOptions = (staffRows ?? []) as { id: string; name: string }[];
  const chosen = staffChoice === "any" ? staffOptions : staffOptions.filter((s) => s.id === staffChoice);
  if (!chosen.length) return null;
  const ids = chosen.map((s) => s.id);

  // Fetch a day of margin either side so buffers and overnight times are never missed.
  const from = new Date(dayBounds(fromYmd, business.timezone).start.getTime() - 86_400_000).toISOString();
  const to = new Date(dayBounds(addDaysYmd(fromYmd, days), business.timezone).start.getTime() + 86_400_000).toISOString();

  const [hours, off, bookings] = await Promise.all([
    db.from("working_hours").select("staff_id, weekday, start_minute, end_minute").eq("business_id", business.id).in("staff_id", ids),
    db.from("time_off").select("staff_id, starts_at, ends_at").eq("business_id", business.id).in("staff_id", ids).lt("starts_at", to).gt("ends_at", from),
    db.from("bookings").select("staff_id, starts_at, ends_at, buffer_before_minutes, buffer_after_minutes, status, hold_expires_at")
      .eq("business_id", business.id).in("staff_id", ids).in("status", ["pending_payment", "confirmed", "completed", "no_show"])
      .lt("starts_at", to).gt("ends_at", from),
  ]);

  const staff: StaffDay[] = chosen.map((s) => ({
    id: s.id,
    workingHours: (hours.data ?? []).filter((h) => h.staff_id === s.id)
      .map((h) => ({ weekday: h.weekday, start: h.start_minute, end: h.end_minute })),
    timeOff: (off.data ?? []).filter((o) => o.staff_id === s.id).map((o) => ({ start: new Date(o.starts_at), end: new Date(o.ends_at) })),
    blocked: ((bookings.data ?? []) as LiveBookingRow[]).filter((b) => b.staff_id === s.id && isLive(b, now)).map(blockedInterval),
  }));

  const svc = service as PublicService;
  return {
    service: svc,
    staffOptions,
    base: {
      tz: business.timezone, now,
      slotIntervalMinutes: business.slot_interval_minutes,
      minNoticeMinutes: business.min_notice_minutes,
      maxAdvanceDays: business.max_advance_days,
      service: { durationMinutes: svc.duration_minutes, bufferBeforeMinutes: svc.buffer_before_minutes, bufferAfterMinutes: svc.buffer_after_minutes },
      staff,
    },
  };
}
