import { formatDateTime } from "../time";

// SMS confirmations: the wording only. Nothing is sent yet (no SMS provider is connected; see
// SmsProvider in provider.ts). When Twilio is added, this is the text it sends.

export type SmsData = { businessName: string; customerName: string; serviceName: string; startsAt: Date; tz: string; manageUrl: string };

/** A text must stay plain: no line breaks or control characters that carriers may mangle. */
const clean = (s: string, max: number) => s.replace(/[\u0000-\u001f\u2028\u2029]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

export function renderSmsConfirmation(d: SmsData): string {
  const first = clean(d.customerName, 40).split(" ")[0] || "there";
  return `${clean(d.businessName, 40)}: Hi ${first}, your ${clean(d.serviceName, 40)} is booked for ${formatDateTime(d.startsAt, d.tz)}. View or cancel: ${d.manageUrl}`;
}

/** Texts over 160 characters are split into parts of 153; the quota counts each part. (Plain characters only.) */
export function smsParts(text: string): number {
  return text.length <= 160 ? 1 : Math.ceil(text.length / 153);
}
