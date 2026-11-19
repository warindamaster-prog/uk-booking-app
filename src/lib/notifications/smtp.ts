import nodemailer, { type Transporter } from "nodemailer";
import type { EmailMessage, EmailProvider, SendResult } from "./provider";

export type SmtpConfig = { host: string; port: number; user: string; pass: string };

/**
 * Sends through any SMTP mailbox (Gmail with an app password, or your own domain's mail server).
 * Fine for testing and small volumes. SMTP has no idempotency keys, so duplicates are prevented
 * by the booking_notifications outbox instead.
 */
export class SmtpEmailProvider implements EmailProvider {
  readonly channel = "email" as const;
  private readonly transport: Transporter;

  constructor(config: SmtpConfig, transport?: Transporter) {
    this.transport = transport ?? nodemailer.createTransport({
      host: config.host, port: config.port, secure: config.port === 465,
      auth: { user: config.user, pass: config.pass },
      connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
    });
  }

  async send(m: EmailMessage): Promise<SendResult> {
    const info = await this.transport.sendMail({
      from: m.from, to: m.to, replyTo: m.replyTo, subject: m.subject, text: m.text, html: m.html,
      attachments: m.attachments?.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
    });
    return { id: String(info.messageId ?? "smtp") };
  }
}
