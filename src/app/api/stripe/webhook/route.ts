import type Stripe from "stripe";
import { after } from "next/server";
import { notifyBookingEvent } from "@/lib/notifications/service";
import { getStripe } from "@/lib/stripe/client";
import { handleConnectEvent } from "@/lib/stripe/events";
import { createPaymentStore } from "@/lib/stripe/store";
import { verifyStripeEvent } from "@/lib/stripe/verify";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });
  const body = await request.text(); // the raw body: the signature is computed over it

  let event: Stripe.Event | null;
  try {
    event = verifyStripeEvent(getStripe(), body, signature, [process.env.STRIPE_CONNECT_WEBHOOK_SECRET, process.env.STRIPE_WEBHOOK_SECRET]);
  } catch { return new Response("Stripe is not configured", { status: 503 }); }
  if (!event) return new Response("Invalid signature", { status: 400 });

  const db = createAdminClient();
  const seen = await db.from("stripe_events").select("event_id").eq("event_id", event.id).maybeSingle();
  if (seen.data) return Response.json({ received: true, duplicate: true });

  try {
    const done = event.account
      ? await handleConnectEvent(event, {
          store: createPaymentStore(db),
          refund: async (account, paymentIntent, key) => getStripe().refunds.create({ payment_intent: paymentIntent }, { stripeAccount: account, idempotencyKey: key }),
          notifyConfirmed: (bookingId) => after(() => notifyBookingEvent(bookingId, "confirmation")),
        })
      : "ignored: platform events are handled in the billing step";
    await db.from("stripe_events").insert({ event_id: event.id, type: event.type });
    return Response.json({ received: true, done });
  } catch (e) {
    console.error("stripe webhook failed", event.type, e instanceof Error ? e.message : e);
    return new Response("Handler failed", { status: 500 }); // Stripe retries
  }
}
