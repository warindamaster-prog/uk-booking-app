import type { Recipient } from "./templates";

export const MAX_ATTEMPTS = 5;

/** Strips anything that could break out of a display name in the From header. */
export const safeDisplayName = (s: string) => s.replace(/[\r\n"<>\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "Bookings";

export type BookingEvent = "confirmation" | "reschedule" | "cancellation";

/** Who hears about each event. The business is told about new bookings and customer cancellations. */
export function recipientsFor(event: BookingEvent, cancelledBy: string | null): Recipient[] {
  if (event === "confirmation") return ["customer", "business"];
  if (event === "cancellation") return cancelledBy === "customer" ? ["customer", "business"] : ["customer"];
  return ["customer"];
}
