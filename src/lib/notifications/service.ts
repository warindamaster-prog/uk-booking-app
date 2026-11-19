import "server-only";
import { publicEnv } from "@/lib/env";
import { bookingTokenSecret } from "@/lib/server-env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createMailers } from "./resend";
import { recipientsFor } from "./rules";
import { sendNotification, type NotifyConfig } from "./send";
import type { BookingEvent } from "./rules";

export function notifyConfig(): NotifyConfig {
  return {
    siteUrl: publicEnv().NEXT_PUBLIC_SITE_URL,
    tokenSecret: bookingTokenSecret(),
  };
}

/**
 * Sends the emails for a booking event. Never throws: a failed email must not break a booking.
 * Failures are recorded in booking_notifications and retried by the cron job.
 * Call it inside `after()` so the customer doesn't wait for the email provider.
 */
export async function notifyBookingEvent(bookingId: string, event: BookingEvent): Promise<void> {
  try {
    const db = createAdminClient();
    const mail = createMailers();
    const cfg = notifyConfig();
    const { data: b } = await db.from("bookings").select("cancelled_by").eq("id", bookingId).maybeSingle();
    await Promise.allSettled(recipientsFor(event, b?.cancelled_by ?? null).map((recipient) =>
      sendNotification(db, mail, cfg, { bookingId, kind: event, recipient })));
  } catch (e) {
    console.error("notifyBookingEvent failed", bookingId, event, e instanceof Error ? e.message : e);
  }
}
