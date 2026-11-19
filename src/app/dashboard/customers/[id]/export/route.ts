import { requireOwner } from "@/lib/auth";
import { buildCustomerExport, exportFilename } from "@/lib/customers";
import { uuid } from "@/lib/validation/catalog";

export const dynamic = "force-dynamic";

/** A downloadable copy of one customer's data. Owner only; row level security scopes it to their business. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = uuid.safeParse((await params).id);
  if (!id.success) return new Response("Not found", { status: 404 });
  const { supabase, business } = await requireOwner();

  const { data: customer } = await supabase.from("customers")
    .select("name, email, phone, marketing_consent, marketing_consent_at, created_at, anonymised_at")
    .eq("id", id.data).eq("business_id", business.id).maybeSingle();
  if (!customer || customer.anonymised_at) return new Response("Not found", { status: 404 });

  const [{ data: bookings }, { data: staff }] = await Promise.all([
    supabase.from("bookings")
      .select("staff_id, service_name, starts_at, ends_at, status, price_pence, deposit_pence, deposit_status, created_at, cancelled_at, cancelled_by")
      .eq("business_id", business.id).eq("customer_id", id.data).order("starts_at"),
    supabase.from("staff").select("id, name").eq("business_id", business.id),
  ]);
  const staffName = new Map((staff ?? []).map((s) => [s.id, s.name as string]));
  const bookingIds = await supabase.from("bookings").select("id").eq("business_id", business.id).eq("customer_id", id.data);
  const { data: emails } = (bookingIds.data ?? []).length
    ? await supabase.from("booking_notifications").select("kind, status, sent_at, created_at")
        .eq("business_id", business.id).eq("recipient", "customer").in("booking_id", (bookingIds.data ?? []).map((b) => b.id)).order("created_at")
    : { data: [] };

  const now = new Date();
  const body = buildCustomerExport({
    businessName: business.name, exportedAt: now, customer,
    bookings: (bookings ?? []).map((b) => ({ ...b, staffName: staffName.get(b.staff_id) ?? "" })),
    emails: emails ?? [],
  });
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename(id.data, now)}"`,
      "Cache-Control": "no-store",
    },
  });
}
