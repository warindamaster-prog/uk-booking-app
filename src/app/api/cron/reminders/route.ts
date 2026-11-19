import { timingSafeEqual } from "node:crypto";
import { runNotificationJobs } from "@/lib/notifications/jobs";
import { createMailers } from "@/lib/notifications/resend";
import { notifyConfig } from "@/lib/notifications/service";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false; // not configured: refuse everything
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

async function handle(request: Request) {
  if (!authorised(request)) return new Response("Unauthorized", { status: 401 });
  try {
    const counts = await runNotificationJobs(createAdminClient(), createMailers(), notifyConfig());
    return Response.json({ ok: true, ...counts });
  } catch (e) {
    console.error("cron failed", e instanceof Error ? e.message : e);
    return Response.json({ ok: false }, { status: 500 });
  }
}

// Vercel Cron calls with GET; other schedulers can use POST.
export const GET = handle;
export const POST = handle;
