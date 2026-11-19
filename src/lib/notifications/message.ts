import { formatDateTime, formatTime } from "../time";

/** Placeholders a shop can use in its own message. Anything else is left as typed. */
export const PLACEHOLDERS = ["customer_name", "service", "date", "time", "staff", "shop_name"] as const;
export type Placeholder = (typeof PLACEHOLDERS)[number];

export type MessageData = {
  customerName: string; serviceName: string; staffName: string; businessName: string;
  startsAt: Date; tz: string;
};

export function placeholderValues(d: MessageData): Record<Placeholder, string> {
  return {
    customer_name: d.customerName,
    service: d.serviceName,
    date: formatDateTime(d.startsAt, d.tz),
    time: formatTime(d.startsAt, d.tz),
    staff: d.staffName,
    shop_name: d.businessName,
  };
}

/** Fills {{placeholders}} (spaces allowed inside the braces, case-insensitive). Plain text only. */
export function fillMessage(template: string, d: MessageData): string {
  const values = placeholderValues(d);
  return template
    .replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (whole, key: string) => values[key.toLowerCase() as Placeholder] ?? whole)
    .replace(/\r\n?/g, "\n")
    .trim();
}
