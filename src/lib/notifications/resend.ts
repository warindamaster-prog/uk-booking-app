import "server-only";
import { Resend } from "resend";
import { chooseProvider, RedirectingEmailProvider, senderSettings } from "./choose";
import type { EmailMessage, EmailProvider, Mailers, SendResult } from "./provider";
import { SmtpEmailProvider } from "./smtp";

export class ResendEmailProvider implements EmailProvider {
  readonly channel = "email" as const;
  private readonly client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async send(m: EmailMessage): Promise<SendResult> {
    const { data, error } = await this.client.emails.send(
      {
        from: m.from,
        to: m.to,
        replyTo: m.replyTo,
        subject: m.subject,
        text: m.text,
        html: m.html,
        attachments: m.attachments?.map((a) => ({ filename: a.filename, content: Buffer.from(a.content, "utf8"), contentType: a.contentType })),
      },
      { idempotencyKey: m.idempotencyKey },
    );
    if (error || !data) throw new Error(`Resend: ${error?.name ?? "error"}: ${error?.message ?? "no response"}`);
    return { id: data.id };
  }
}

/** Development only: prints the email instead of sending it. */
export class ConsoleEmailProvider implements EmailProvider {
  readonly channel = "email" as const;
  async send(m: EmailMessage): Promise<SendResult> {
    console.info(`[email:dev] to=${m.to} subject=${JSON.stringify(m.subject)} attachments=${m.attachments?.length ?? 0}\n${m.text}`);
    return { id: `console-${m.idempotencyKey}` };
  }
}

function build(env: NodeJS.ProcessEnv, prefix: "" | "NOTIFY_"): EmailProvider {
  if (prefix === "NOTIFY_") {
    return new SmtpEmailProvider({
      host: env.NOTIFY_SMTP_HOST!, port: Number(env.NOTIFY_SMTP_PORT ?? 587), user: env.NOTIFY_SMTP_USER ?? "", pass: env.NOTIFY_SMTP_PASS ?? "",
    });
  }
  const name = chooseProvider(env);
  if (name === "smtp") {
    return new SmtpEmailProvider({ host: env.SMTP_HOST!, port: Number(env.SMTP_PORT ?? 587), user: env.SMTP_USER ?? "", pass: env.SMTP_PASS ?? "" });
  }
  if (name === "resend") return new ResendEmailProvider(env.RESEND_API_KEY!);
  if (name === "console") return new ConsoleEmailProvider();
  throw new Error("No email provider is configured: set SMTP_HOST (and SMTP_USER, SMTP_PASS) or RESEND_API_KEY");
}

export function createMailers(env: NodeJS.ProcessEnv = process.env): Mailers {
  const settings = senderSettings(env);
  const wrap = (p: EmailProvider) => (env.EMAIL_OVERRIDE_TO ? new RedirectingEmailProvider(p, env.EMAIL_OVERRIDE_TO) : p);
  let customer: EmailProvider | undefined;
  let business: EmailProvider | undefined;
  return {
    provider(recipient) {
      if (recipient === "business" && settings.separateBusinessMailbox) return (business ??= wrap(build(env, "NOTIFY_")));
      return (customer ??= wrap(build(env, "")));
    },
    fromAddress: (recipient) => (recipient === "business" ? settings.businessFrom : settings.customerFrom),
    fromName: (recipient, businessName) => (recipient === "business" ? settings.businessName : businessName),
  };
}
