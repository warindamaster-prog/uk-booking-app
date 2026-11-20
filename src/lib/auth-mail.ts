import "server-only";
import { createMailers } from "./notifications/resend";

/** Sends an account email (confirm, reset...) from our own mailbox. Throws if the mailbox refuses it. */
export async function sendAccountEmail(to: string, mail: { subject: string; text: string; html: string }): Promise<void> {
  const mailers = createMailers();
  await mailers.provider("business").send({
    from: `"Booking account" <${mailers.fromAddress("business")}>`,
    to,
    ...mail,
    idempotencyKey: `account:${to}:${Date.now()}`,
  });
}
