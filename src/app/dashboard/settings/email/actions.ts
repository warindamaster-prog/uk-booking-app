"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { zodState, type FormState } from "@/lib/form";
import { assertPublicHost } from "@/lib/notifications/safe-host";
import { SmtpEmailProvider } from "@/lib/notifications/smtp";
import { safeDisplayName } from "@/lib/notifications/rules";
import { decryptSecret, encryptSecret, parseKey } from "@/lib/secret-box";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailSettingsSchema } from "@/lib/validation/email-settings";

const GENERIC = "Something went wrong. Please try again.";

function explain(e: unknown): string {
  const code = (e as { code?: string })?.code;
  const msg = e instanceof Error ? e.message : "";
  if (code === "EAUTH" || /Invalid login|authentication/i.test(msg)) return "The mail server refused that email address or password. With Gmail, use an app password, not your normal password.";
  if (code === "ECONNECTION" || code === "ETIMEDOUT" || code === "ESOCKET" || code === "EDNS" || /ENOTFOUND|ECONNREFUSED/.test(msg)) return "We couldn't connect to that mail server. Check the server name and port.";
  if (/isn't (valid|allowed)/.test(msg)) return msg;
  return "The test email couldn't be sent. Check the details and try again.";
}

export async function saveEmailSettings(_: FormState, formData: FormData): Promise<FormState> {
  const { business } = await requireOwner();
  const raw = Object.fromEntries(["host", "port", "user", "fromName"].map((k) => [k, String(formData.get(k) ?? "")]));
  const pass = String(formData.get("pass") ?? "");
  const parsed = emailSettingsSchema.safeParse({ ...raw, pass });
  if (!parsed.success) return zodState(parsed.error, raw);

  const db = createAdminClient();
  const limit = await db.rpc("rate_limit_hit", { p_key: `email-settings:${business.id}`, p_window_seconds: 600, p_limit: 8 });
  if (limit.error) return { error: GENERIC, values: raw };
  if (!limit.data) return { error: "Too many attempts. Please wait a few minutes and try again.", values: raw };

  let key: Buffer;
  try { key = parseKey(process.env.EMAIL_CREDENTIALS_KEY); } catch {
    console.error("EMAIL_CREDENTIALS_KEY is missing or invalid");
    return { error: "Sending from your own mailbox isn't switched on yet. Please contact support.", values: raw };
  }

  const { data: existing } = await db.from("business_email_settings").select("smtp_pass_enc").eq("business_id", business.id).maybeSingle();
  let password = pass;
  if (!password) {
    if (!existing) return { fieldErrors: { pass: ["Enter your email password"] }, values: raw };
    password = decryptSecret(existing.smtp_pass_enc, key); // left blank: keep the saved one
  }

  const { data: biz } = await db.from("businesses").select("name, email").eq("id", business.id).single();
  if (!biz?.email) return { error: "Add your contact email in Settings first. The test email is sent there.", values: raw };

  try {
    await assertPublicHost(parsed.data.host);
    const name = parsed.data.fromName ?? biz.name;
    await new SmtpEmailProvider({ host: parsed.data.host, port: parsed.data.port, user: parsed.data.user, pass: password }).send({
      from: `"${safeDisplayName(name)}" <${parsed.data.user}>`,
      to: biz.email,
      subject: "Test email from your booking page",
      text: `This is a test. If you can read it, your booking confirmations to customers will now be sent from ${parsed.data.user}.`,
      html: `<p>This is a test. If you can read it, your booking confirmations to customers will now be sent from <b>${parsed.data.user.replace(/[<>&"]/g, "")}</b>.</p>`,
      idempotencyKey: `email-test:${business.id}:${Date.now()}`,
    });
  } catch (e) {
    console.error("shop mailbox test failed", business.id, e instanceof Error ? e.message : e);
    return { error: explain(e), values: raw };
  }

  const { error } = await db.from("business_email_settings").upsert({
    business_id: business.id, smtp_host: parsed.data.host, smtp_port: parsed.data.port, smtp_user: parsed.data.user,
    smtp_pass_enc: encryptSecret(password, key), from_name: parsed.data.fromName,
    verified_at: new Date().toISOString(), last_error: null, last_error_at: null, updated_at: new Date().toISOString(),
  }, { onConflict: "business_id" });
  if (error) return { error: GENERIC, values: raw };
  revalidatePath("/dashboard/settings/email");
  return { message: `Saved. A test email was sent to ${biz.email}. Customers' emails will now come from ${parsed.data.user}.`, values: { ...raw, pass: "" } };
}

export async function removeEmailSettings(): Promise<FormState> {
  const { business } = await requireOwner();
  const { error } = await createAdminClient().from("business_email_settings").delete().eq("business_id", business.id);
  if (error) return { error: GENERIC };
  revalidatePath("/dashboard/settings/email");
  return { message: "Removed. Customers' emails go back to our standard sender, with your address for replies." };
}
