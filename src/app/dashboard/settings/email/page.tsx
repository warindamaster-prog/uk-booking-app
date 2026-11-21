import { BackLink } from "@/components/back-link";
import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth";
import { EmailSettingsForm } from "./email-form";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Email sending" };

export default async function EmailSettingsPage() {
  const { supabase, business } = await requireOwner();
  const t = await getT();
  const { data: s } = await supabase.from("business_email_settings")
    .select("smtp_host, smtp_port, smtp_user, from_name, verified_at, last_error, last_error_at").eq("business_id", business.id).maybeSingle();
  return (
    <main className="space-y-6">
      <BackLink href="/dashboard/settings" label={t("← Settings")} />
      <h1 className="text-2xl font-semibold">{t("Email sending")}</h1>
      <p className="text-sm">
        {t("Send your customers' booking emails from your own email address, so they come from a name they know. Without this, they come from our standard sender and customers' replies still reach you.")}
      </p>
      {s?.last_error && (
        <p role="alert" className="rounded-md border border-red-700 p-3 text-sm text-red-800 dark:text-red-400">
          {t("Your mailbox recently refused an email, so we sent it from our standard sender instead. Check your password below and save again.")}
          <span className="mt-1 block opacity-80">{s.last_error}</span>
        </p>
      )}
      <EmailSettingsForm saved={s ? { host: s.smtp_host, port: s.smtp_port, user: s.smtp_user, fromName: s.from_name ?? "" } : null} />
    </main>
  );
}
