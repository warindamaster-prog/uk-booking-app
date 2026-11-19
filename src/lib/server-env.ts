import "server-only";

/** Secret used to derive customers' cancellation links. At least 32 random characters. */
export function bookingTokenSecret(): string {
  const s = process.env.BOOKING_TOKEN_SECRET;
  if (!s || s.length < 32) throw new Error("BOOKING_TOKEN_SECRET must be set to a random string of at least 32 characters");
  return s;
}
