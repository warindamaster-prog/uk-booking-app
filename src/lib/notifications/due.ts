const DAY = 24 * 3_600_000;

/**
 * A reminder goes out once, when the booking is within 24 hours of starting.
 * A booking made less than 24 hours ahead has just had its confirmation, so no reminder is sent.
 * Moving a booking clears reminder_sent_at (database rule), so it gets a fresh reminder for the new time.
 */
export function isReminderDue(
  b: { status: string; starts_at: string | Date; created_at: string | Date; reminder_sent_at: string | Date | null },
  now: Date,
): boolean {
  if (b.status !== "confirmed" || b.reminder_sent_at) return false;
  const start = new Date(b.starts_at).getTime();
  if (start <= now.getTime() || start - now.getTime() > DAY) return false;
  return new Date(b.created_at).getTime() <= start - DAY;
}
