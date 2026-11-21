import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Health check and keep-alive. Runs one trivial query so the database counts as in use (the Supabase
 * Free plan pauses projects after about a week with no activity). Public on purpose and reveals nothing:
 * it returns only ok / not ok. Creates no data. Call it from a scheduler every few days.
 */
async function handle() {
  try {
    const { error } = await createAdminClient().from("businesses").select("id", { head: true, count: "exact" }).limit(1);
    if (error) throw error;
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("health check failed", e instanceof Error ? e.message : e);
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export const GET = handle;
export const HEAD = handle;
