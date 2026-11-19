"use server";

import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { bookingTokenSecret } from "@/lib/server-env";
import { connectConfigured, getStripe } from "@/lib/stripe/client";
import { signConnectState } from "@/lib/stripe/connect";
import { createAdminClient } from "@/lib/supabase/admin";

/** Sends the owner to Stripe to connect (or create) their own Stripe account. */
export async function connectStripe(): Promise<void> {
  const { business } = await requireOwner();
  if (!connectConfigured()) redirect("/dashboard/payments?error=not_configured");
  const url = getStripe().oauth.authorizeUrl({
    client_id: process.env.STRIPE_CONNECT_CLIENT_ID,
    response_type: "code",
    scope: "read_write",
    state: signConnectState(bookingTokenSecret(), business.id),
    redirect_uri: `${publicEnv().NEXT_PUBLIC_SITE_URL}/api/stripe/connect/callback`,
  });
  redirect(url);
}

export async function disconnectStripe(): Promise<void> {
  const { business } = await requireOwner();
  const db = createAdminClient();
  const { data } = await db.from("businesses").select("stripe_account_id").eq("id", business.id).single();
  if (data?.stripe_account_id && connectConfigured()) {
    try {
      await getStripe().oauth.deauthorize({ client_id: process.env.STRIPE_CONNECT_CLIENT_ID, stripe_user_id: data.stripe_account_id });
    } catch (e) {
      console.error("stripe deauthorize failed", e instanceof Error ? e.message : e); // already revoked on Stripe's side is fine
    }
  }
  await db.from("businesses").update({ stripe_account_id: null, stripe_charges_enabled: false }).eq("id", business.id);
  redirect("/dashboard/payments?disconnected=1");
}
