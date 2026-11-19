import "server-only";
import Stripe from "stripe";

let cached: Stripe | undefined;

/** Stripe is optional: without keys the app runs and deposits/billing are simply unavailable. */
export const stripeConfigured = () => !!process.env.STRIPE_SECRET_KEY;
export const connectConfigured = () => stripeConfigured() && !!process.env.STRIPE_CONNECT_CLIENT_ID;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return (cached ??= new Stripe(key));
}
