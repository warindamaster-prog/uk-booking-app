import "server-only";
import { Resend } from "resend";
import { chooseProvider, RedirectingEmailProvider } from "./choose";
import type { EmailMessage, EmailProvider, SendResult } from "./provider";
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

export function getEmailProvider(): EmailProvider {
  const env = process.env;
  const name = chooseProvider(env);
  let provider: EmailProvider;
  if (name === "smtp") {
    provider = new SmtpEmailProvider({
      host: env.SMTP_HOST!, port: Number(env.SMTP_PORT ?? 587), user: env.SMTP_USER ?? "", pass: env.SMTP_PASS ?? "",
    });
  } else if (name === "resend") provider = new ResendEmailProvider(env.RESEND_API_KEY!);
  else if (name === "console") provider = new ConsoleEmailProvider();
  else throw new Error("No email provider is configured: set SMTP_HOST (and SMTP_USER, SMTP_PASS) or RESEND_API_KEY");
  return env.EMAIL_OVERRIDE_TO ? new RedirectingEmailProvider(provider, env.EMAIL_OVERRIDE_TO) : provider;
}
