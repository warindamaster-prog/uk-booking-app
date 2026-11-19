import { NextResponse, type NextRequest } from "next/server";
import { requireOwner } from "@/lib/auth";
import { bookingTokenSecret } from "@/lib/server-env";
import { connectConfigured, getStripe } from "@/lib/stripe/client";
import { verifyConnectState } from "@/lib/stripe/connect";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Stripe sends the owner back here after they approve the connection. */
export async function GET(request: NextRequest) {
  const back = (q: string) => NextResponse.redirect(new URL(`/dashboard/payments?${q}`, request.url));
  const { business } = await requireOwner();
  const params = request.nextUrl.searchParams;

  if (params.get("error")) return back("error=declined");
  const code = params.get("code"), state = params.get("state");
  const verified = state ? verifyConnectState(bookingTokenSecret(), state) : null;
  if (!code || !verified || verified.businessId !== business.id || !connectConfigured()) return back("error=invalid");

  try {
    const stripe = getStripe();
    const token = await stripe.oauth.token({ grant_type: "authorization_code", code });
    if (!token.stripe_user_id) return back("error=failed");
    const account = await stripe.accounts.retrieve(token.stripe_user_id);
    const { error } = await createAdminClient().from("businesses")
      .update({ stripe_account_id: token.stripe_user_id, stripe_charges_enabled: account.charges_enabled === true }).eq("id", business.id);
    if (error) return back(error.code === "23505" ? "error=in_use" : "error=failed");
    return back("connected=1");
  } catch (e) {
    console.error("stripe connect callback failed", e instanceof Error ? e.message : e);
    return back("error=failed");
  }
}
