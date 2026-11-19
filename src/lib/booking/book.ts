import { computeSlots, type AvailabilityQuery } from "../availability";
import { todayYmd } from "../time";
import type { BookingInput } from "../validation/booking";
import { candidateStaff } from "./slots";
import { byteaParam } from "./token";

export type CreateBookingRpc = (args: Record<string, unknown>) => Promise<{ error: { code?: string } | null }>;

export type BookOutcome =
  | { ok: true; bookingId: string; token: string; staffId: string }
  | { ok: false; reason: "slot_taken" | "deposit_unavailable" | "error" };

/**
 * Re-checks the slot with the availability engine, then tries each free staff member in turn.
 * The database constraint is the final judge: a 23P01 (exclusion violation) means someone else
 * got that person first, so we move on to the next candidate.
 */
export async function bookFirstAvailable(
  deps: { rpc: CreateBookingRpc; newBooking: () => { id: string; raw: string; hashHex: string } },
  p: {
    business: { id: string; timezone: string; stripe_charges_enabled: boolean };
    base: Omit<AvailabilityQuery, "date">;
    depositPence: number;
    input: BookingInput;
  },
): Promise<BookOutcome> {
  const requireDeposit = p.depositPence > 0;
  if (requireDeposit && !p.business.stripe_charges_enabled) return { ok: false, reason: "deposit_unavailable" };

  const startsAt = new Date(p.input.startsAt);
  const date = todayYmd(p.business.timezone, startsAt);
  const slot = computeSlots({ ...p.base, date }).find((s) => s.start.getTime() === startsAt.getTime());
  const candidates = candidateStaff(slot, p.input.staff);
  if (!candidates.length) return { ok: false, reason: "slot_taken" };

  for (const staffId of candidates) {
    const booking = deps.newBooking();
    const { error } = await deps.rpc({
      p_business_id: p.business.id, p_service_id: p.input.serviceId, p_staff_id: staffId,
      p_starts_at: startsAt.toISOString(), p_name: p.input.name, p_email: p.input.email, p_phone: p.input.phone,
      p_marketing_consent: p.input.marketingConsent, p_cancel_token_hash: byteaParam(booking.hashHex),
      p_require_deposit: requireDeposit, p_booking_id: booking.id,
    });
    if (!error) return { ok: true, bookingId: booking.id, token: booking.raw, staffId };
    if (error.code !== "23P01") return { ok: false, reason: "error" };
  }
  return { ok: false, reason: "slot_taken" };
}
