// Notification providers are pluggable. Email is implemented with Resend (resend.ts).
// SMS reminders are designed here as an interface only; a Twilio provider can be added later
// without touching the rest of the code. No SMS is sent today.

export type Channel = "email" | "sms";

export type SendResult = { id: string };

export type EmailAttachment = { filename: string; content: string; contentType: string };

export type EmailMessage = {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
  attachments?: EmailAttachment[];
  /** Sending the same key twice must not deliver twice (providers dedupe for about 24 hours). */
  idempotencyKey: string;
};

export interface EmailProvider {
  readonly channel: "email";
  send(message: EmailMessage): Promise<SendResult>;
}

export type SmsMessage = { to: string; body: string; idempotencyKey: string };

/** Not implemented yet (Twilio later). */
export interface SmsProvider {
  readonly channel: "sms";
  send(message: SmsMessage): Promise<SendResult>;
}
