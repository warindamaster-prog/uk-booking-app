import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;

export const LIVE_STATUSES = ["confirmed", "pending_payment", "no_show", "completed"] as const;

export type BookingView = {
  id: string;
  staff_id: string;
  service_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  service_name: string;
  duration_minutes: number;
  price_pence: number;
  deposit_pence: number;
  deposit_status: string;
  cancelled_at: string | null;
  cancelled_by: string | null;
  customer: { name: string; email: string | null; phone: string | null } | null;
  staffName: string;
};

const COLUMNS = "id, staff_id, service_id, customer_id, starts_at, ends_at, status, service_name, duration_minutes, price_pence, deposit_pence, deposit_status, cancelled_at, cancelled_by";

type RawBooking = Omit<BookingView, "customer" | "staffName"> & { customer_id: string };

/** Adds customer and staff names. RLS decides what the signed-in person may see. */
async function hydrate(db: Db, businessId: string, raw: RawBooking[]): Promise<BookingView[]> {
  if (!raw.length) return [];
  const customerIds = [...new Set(raw.map((b) => b.customer_id))];
  const staffIds = [...new Set(raw.map((b) => b.staff_id))];
  const [customers, staff] = await Promise.all([
    db.from("customers").select("id, name, email, phone").eq("business_id", businessId).in("id", customerIds),
    db.from("staff").select("id, name").eq("business_id", businessId).in("id", staffIds),
  ]);
  const c = new Map((customers.data ?? []).map((x) => [x.id, { name: x.name, email: x.email, phone: x.phone }]));
  const s = new Map((staff.data ?? []).map((x) => [x.id, x.name as string]));
  return raw.map(({ customer_id, ...b }) => ({ ...b, customer: c.get(customer_id) ?? null, staffName: s.get(b.staff_id) ?? "Unknown" }));
}

export async function fetchBookings(db: Db, businessId: string, o: {
  startsFrom?: Date; startsBefore?: Date; staffId?: string; statuses?: readonly string[];
  ascending?: boolean; limit?: number; offset?: number;
}): Promise<{ rows: BookingView[]; total: number }> {
  let q = db.from("bookings").select(COLUMNS, { count: "exact" }).eq("business_id", businessId);
  if (o.startsFrom) q = q.gte("starts_at", o.startsFrom.toISOString());
  if (o.startsBefore) q = q.lt("starts_at", o.startsBefore.toISOString());
  if (o.staffId) q = q.eq("staff_id", o.staffId);
  if (o.statuses) q = q.in("status", [...o.statuses]);
  q = q.order("starts_at", { ascending: o.ascending ?? true });
  if (o.limit !== undefined) q = q.range(o.offset ?? 0, (o.offset ?? 0) + o.limit - 1);
  const { data, count } = await q;
  return { rows: await hydrate(db, businessId, (data ?? []) as RawBooking[]), total: count ?? 0 };
}

export async function fetchBooking(db: Db, businessId: string, id: string): Promise<BookingView | null> {
  const { data } = await db.from("bookings").select(COLUMNS).eq("business_id", businessId).eq("id", id).maybeSingle();
  if (!data) return null;
  return (await hydrate(db, businessId, [data as RawBooking]))[0];
}
