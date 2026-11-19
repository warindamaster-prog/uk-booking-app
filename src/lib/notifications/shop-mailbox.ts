import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, parseKey } from "@/lib/secret-box";
import { RedirectingEmailProvider } from "./choose";
import type { EmailProvider } from "./provider";
import { assertPublicHost } from "./safe-host";
import { SmtpEmailProvider } from "./smtp";

type Db = ReturnType<typeof createAdminClient>;
export type ShopMailbox = { provider: EmailProvider; address: string; name: string | null };

/** The shop's own mailbox, if it has set one up and a test email went through. Otherwise null. */
export async function loadShopMailbox(db: Db, businessId: string, env: NodeJS.ProcessEnv = process.env): Promise<ShopMailbox | null> {
  const { data: s } = await db.from("business_email_settings")
    .select("smtp_host, smtp_port, smtp_user, smtp_pass_enc, from_name, verified_at").eq("business_id", businessId).maybeSingle();
  if (!s || !s.verified_at) return null;
  try {
    const pass = decryptSecret(s.smtp_pass_enc, parseKey(env.EMAIL_CREDENTIALS_KEY));
    await assertPublicHost(s.smtp_host);
    const smtp = new SmtpEmailProvider({ host: s.smtp_host, port: s.smtp_port, user: s.smtp_user, pass });
    return { provider: env.EMAIL_OVERRIDE_TO ? new RedirectingEmailProvider(smtp, env.EMAIL_OVERRIDE_TO) : smtp, address: s.smtp_user, name: s.from_name };
  } catch (e) {
    await recordShopMailboxError(db, businessId, e);
    return null;
  }
}

export async function recordShopMailboxError(db: Db, businessId: string, e: unknown): Promise<void> {
  const message = (e instanceof Error ? e.message : String(e)).slice(0, 300);
  await db.from("business_email_settings").update({ last_error: message, last_error_at: new Date().toISOString() }).eq("business_id", businessId);
}
