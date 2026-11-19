"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { acceptsBookings, getBusinessBySlug, loadBookingContext } from "@/lib/booking/data";
import { bookFirstAvailable } from "@/lib/booking/book";
import { clientIp, limiterKey, newCancelToken } from "@/lib/booking/token";
import { zodState, type FormState } from "@/lib/form";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayYmd } from "@/lib/time";
import { bookingInputSchema } from "@/lib/validation/booking";

const GENERIC = "Something went wrong. Please try again.";
const TAKEN = "Sorry, that time has just been taken. Please go back and choose another time.";

export async function createPublicBooking(_: FormState, formData: FormData): Promise<FormState> {
  const str = (k: string) => String(formData.get(k) ?? "");

  // Bots fill the hidden field; give them nothing useful.
  if (str("website") !== "") return { error: GENERIC };

  const raw = {
    slug: str("slug"), serviceId: str("serviceId"), staff: str("staff"), startsAt: str("startsAt"),
    name: str("name"), email: str("email"), phone: str("phone"),
    marketingConsent: formData.get("marketingConsent") === "on", website: "",
  };
  const values = { name: raw.name, email: raw.email, phone: raw.phone, marketingConsent: raw.marketingConsent ? "on" : "" };
  const parsed = bookingInputSchema.safeParse(raw);
  if (!parsed.success) return zodState(parsed.error, values);
  const input = parsed.data;

  // Rate limits: per client address and per email, using keyed hashes (no raw IP/email stored).
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const h = await headers();
  const db = createAdminClient();
  const ip = limiterKey("book-ip", clientIp((n) => h.get(n)), secret);
  const mail = limiterKey("book-email", input.email, secret);
  const [byIp, byEmail] = await Promise.all([
    db.rpc("rate_limit_hit", { p_key: ip, p_window_seconds: 600, p_limit: 6 }),
    db.rpc("rate_limit_hit", { p_key: mail, p_window_seconds: 3600, p_limit: 4 }),
  ]);
  if (byIp.error || byEmail.error) return { error: GENERIC, values };
  if (!byIp.data || !byEmail.data) return { error: "Too many attempts. Please wait a little while and try again.", values };

  const business = await getBusinessBySlug(input.slug);
  if (!business || !acceptsBookings(business)) return { error: GENERIC, values };

  // Re-check the slot on the server: the page the customer saw may be stale or tampered with.
  const startsAt = new Date(input.startsAt);
  const date = todayYmd(business.timezone, startsAt);
  const ctx = await loadBookingContext(business, input.serviceId, input.staff, date, 1);
  if (!ctx) return { error: GENERIC, values };

  // Different people charge different prices: the customer must pick a person or level, so the price is known.
  if (ctx.price_pence === null) return { error: "Please choose who you'd like to book with.", values };

  const outcome = await bookFirstAvailable(
    {
      rpc: async (args) => { const { error } = await db.rpc("create_booking", args); return { error }; },
      newToken: newCancelToken,
    },
    { business, base: ctx.base, depositPence: ctx.service.deposit_pence, input },
  );
  if (outcome.ok) {
    // Step 7 (Stripe): for bookings with a deposit, redirect to Checkout here instead.
    redirect(`/b/${business.slug}/booking/${outcome.token}`);
  }
  if (outcome.reason === "deposit_unavailable") {
    return { error: "This service needs a deposit, which isn't available online yet. Please contact the business.", values };
  }
  if (outcome.reason === "error") return { error: GENERIC, values };
  return { error: TAKEN, values };
}
