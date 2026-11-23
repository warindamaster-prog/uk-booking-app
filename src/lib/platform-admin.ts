import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";

/** The owner's own login emails (PLATFORM_ADMIN_EMAILS, comma separated). They may open /admin. Everyone else gets a "not found" page. */
export function isPlatformAdmin(email: string | null | undefined, list: string | undefined = process.env.PLATFORM_ADMIN_EMAILS): boolean {
  if (!email || !list) return false;
  const e = email.trim().toLowerCase();
  return list.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean).includes(e);
}

export async function requirePlatformAdmin() {
  const ctx = await requireUser();
  if (!isPlatformAdmin(ctx.user.email)) notFound();
  return ctx;
}
