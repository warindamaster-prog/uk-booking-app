import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { dayBounds, type AvailabilityQuery, type StaffDay } from "@/lib/availability";
import { billingEnabled, bookingsOpen } from "@/lib/billing";
import { addDaysYmd } from "@/lib/time";
import { parseChoice, priceFor, selectStaff, type StaffInfo } from "./choices";
import { blockedInterval, isLive, type LiveBookingRow } from "./slots";

// Everything here uses the service-role client, which bypasses RLS. Every query is
// therefore scoped by business_id explicitly, and only public-safe columns are returned.

export type PublicBusiness = {
  id: string; name: string; slug: string; timezone: string; logo_path: string | null;
  slot_interval_minutes: number; min_notice_minutes: number; max_advance_days: number;
  privacy_notice_url: string | null; stripe_charges_enabled: boolean; cancellation_window_hours: number;
  billing_status: string; trial_ends_at: string;
};

export type PublicService = {
  id: string; name: string; description: string | null; duration_minutes: number;
  buffer_before_minutes: number; buffer_after_minutes: number; price_pence: number; deposit_pence: number;
};

/** A service as listed to customers: `from_pence` is the lowest price any available person charges. */
export type ListedService = PublicService & { from_pence: number; price_varies: boolean };

export const acceptsBookings = (b: Pick<PublicBusiness, "billing_status" | "trial_ends_at">, now: Date = new Date()) =>
  bookingsOpen({ status: b.billing_status, trial_ends_at: b.trial_ends_at }, { now, billingEnabled: billingEnabled() });

export async function getBusinessBySlug(slug: string): Promise<PublicBusiness | null> {
  const db = createAdminClient();
  const { data } = await db.from("businesses")
    .select("id, name, slug, timezone, logo_path, slot_interval_minutes, min_notice_minutes, max_advance_days, privacy_notice_url, stripe_charges_enabled, cancellation_window_hours")
    .eq("slug", slug).maybeSingle();
  if (!data) return null;
  const { data: billing } = await db.from("business_billing").select("status, trial_ends_at").eq("business_id", data.id).maybeSingle();
  // No billing row means something is wrong: keep the page closed rather than open.
  return { ...data, billing_status: billing?.status ?? "unpaid", trial_ends_at: billing?.trial_ends_at ?? new Date(0).toISOString() } as PublicBusiness;
}

export function logoUrl(path: string | null): string | null {
  if (!path) return null;
  return createAdminClient().storage.from("logos").getPublicUrl(path).data.publicUrl;
}

/** Active services that at least one active staff member offers, with the lowest price on offer. */
export async function listBookableServices(businessId: string): Promise<ListedService[]> {
  const db = createAdminClient();
  const [services, links, staff, prices] = await Promise.all([
    db.from("services").select("id, name, description, duration_minutes, buffer_before_minutes, buffer_after_minutes, price_pence, deposit_pence")
      .eq("business_id", businessId).eq("active", true).order("sort_order").order("name"),
    db.from("staff_services").select("service_id, staff_id").eq("business_id", businessId),
    db.from("staff").select("id, level_id").eq("business_id", businessId).eq("active", true),
    db.from("service_level_prices").select("service_id, level_id, price_pence").eq("business_id", businessId),
  ]);
  const levelOf = new Map((staff.data ?? []).map((s) => [s.id, s.level_id as string | null]));
  const override = new Map((prices.data ?? []).map((p) => [`${p.service_id}:${p.level_id}`, p.price_pence as number]));

  return ((services.data ?? []) as PublicService[]).flatMap((svc) => {
    const offered = (links.data ?? []).filter((l) => l.service_id === svc.id && levelOf.has(l.staff_id));
    if (!offered.length) return [];
    const each = offered.map((l) => {
      const level = levelOf.get(l.staff_id);
      return (level ? override.get(`${svc.id}:${level}`) : undefined) ?? svc.price_pence;
    });
    return [{ ...svc, from_pence: Math.min(...each), price_varies: new Set(each).size > 1 }];
  });
}

export type BookingContext = {
  service: PublicService;
  /** Everyone who offers this service (active), with their level and price for it. */
  staffOptions: StaffInfo[];
  /** The people matching the customer's choice. */
  chosen: StaffInfo[];
  /** The single price for the choice, or null if it mixes prices (customer must choose more precisely). */
  price_pence: number | null;
  /** Ready for computeSlots / findAvailableDates (add `date` for the former). */
  base: Omit<AvailabilityQuery, "date">;
};

/**
 * Loads everything the availability engine needs for `days` days from `fromYmd`.
 * `staffChoice` is "any", a staff id, "level:<id>" or "level:none".
 * Returns null if the service isn't bookable or nobody matches the choice.
 */
export async function loadBookingContext(
  business: PublicBusiness, serviceId: string, staffChoice: string,
  fromYmd: string, days: number, now: Date = new Date(),
): Promise<BookingContext | null> {
  const db = createAdminClient();
  const { data: service } = await db.from("services")
    .select("id, name, description, duration_minutes, buffer_before_minutes, buffer_after_minutes, price_pence, deposit_pence")
    .eq("id", serviceId).eq("business_id", business.id).eq("active", true).maybeSingle();
  if (!service) return null;
  const svc = service as PublicService;

  const { data: links } = await db.from("staff_services").select("staff_id").eq("business_id", business.id).eq("service_id", serviceId);
  const offeredBy = (links ?? []).map((l) => l.staff_id);
  if (!offeredBy.length) return null;

  const [staffRes, levelsRes, pricesRes] = await Promise.all([
    db.from("staff").select("id, name, level_id, description").eq("business_id", business.id).eq("active", true)
      .in("id", offeredBy).order("sort_order").order("name"),
    db.from("staff_levels").select("id, name").eq("business_id", business.id),
    db.from("service_level_prices").select("level_id, price_pence").eq("business_id", business.id).eq("service_id", serviceId),
  ]);
  const levelName = new Map((levelsRes.data ?? []).map((l) => [l.id, l.name as string]));
  const levelPrice = new Map((pricesRes.data ?? []).map((p) => [p.level_id, p.price_pence as number]));

  const staffOptions: StaffInfo[] = (staffRes.data ?? []).map((s) => ({
    id: s.id, name: s.name, level_id: s.level_id, description: s.description,
    level_name: s.level_id ? levelName.get(s.level_id) ?? null : null,
    price_pence: (s.level_id ? levelPrice.get(s.level_id) : undefined) ?? svc.price_pence,
  }));
  const chosen = selectStaff(staffOptions, parseChoice(staffChoice));
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

  return {
    service: svc, staffOptions, chosen, price_pence: priceFor(chosen),
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
