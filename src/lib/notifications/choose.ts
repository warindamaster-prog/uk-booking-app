import type { EmailMessage, EmailProvider, SendResult } from "./provider";

export type ProviderName = "smtp" | "resend" | "console" | "none";

/**
 * EMAIL_PROVIDER=smtp|resend picks explicitly. Otherwise: SMTP if SMTP_HOST is set, else Resend if
 * RESEND_API_KEY is set, else print to the console in development, else nothing (sends fail visibly).
 */
export function chooseProvider(env: Record<string, string | undefined>): ProviderName {
  const wanted = env.EMAIL_PROVIDER?.toLowerCase();
  if (wanted === "smtp") return env.SMTP_HOST ? "smtp" : "none";
  if (wanted === "resend") return env.RESEND_API_KEY ? "resend" : "none";
  if (env.SMTP_HOST) return "smtp";
  if (env.RESEND_API_KEY) return "resend";
  return env.NODE_ENV !== "production" ? "console" : "none";
}

/**
 * Testing safety net: when EMAIL_OVERRIDE_TO is set, every email goes to that one address instead
 * of the real customer or business, with the intended recipient noted in the subject.
 */
export class RedirectingEmailProvider implements EmailProvider {
  readonly channel = "email" as const;
  constructor(private readonly inner: EmailProvider, private readonly to: string) {}
  send(m: EmailMessage): Promise<SendResult> {
    return this.inner.send({ ...m, to: this.to, subject: `[to ${m.to}] ${m.subject}`.replace(/[\r\n]+/g, " ").slice(0, 200) });
  }
}

export type SenderSettings = { customerFrom: string; businessFrom: string; businessName: string; separateBusinessMailbox: boolean };

/**
 * Customer emails use EMAIL_FROM. Alerts to the business use their own mailbox when NOTIFY_SMTP_HOST
 * is set (NOTIFY_SMTP_USER / NOTIFY_SMTP_PASS / NOTIFY_EMAIL_FROM / NOTIFY_FROM_NAME), otherwise the
 * same one as customers.
 */
export function senderSettings(env: Record<string, string | undefined>): SenderSettings {
  const separate = !!env.NOTIFY_SMTP_HOST;
  const customerFrom = env.EMAIL_FROM ?? "bookings@example.com";
  return {
    customerFrom,
    businessFrom: separate ? env.NOTIFY_EMAIL_FROM ?? env.NOTIFY_SMTP_USER ?? customerFrom : customerFrom,
    businessName: env.NOTIFY_FROM_NAME?.trim() || "Booking alerts",
    separateBusinessMailbox: separate,
  };
}
