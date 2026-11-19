import { formatPence } from "../money";
import { formatDateTime, formatTime } from "../time";

export type EmailKind = "confirmation" | "reminder" | "cancellation" | "reschedule";
export type Recipient = "customer" | "business";

export type EmailData = {
  businessName: string;
  serviceName: string;
  staffName: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  startsAt: Date;
  endsAt: Date;
  tz: string;
  pricePence: number;
  depositPence: number;
  depositStatus: string;
  /** The customer's token link: view and cancel. */
  manageUrl: string;
  /** The business's own dashboard page for this booking. */
  dashboardUrl: string;
  /** Last moment the customer can cancel online, or null if not applicable. */
  cancelDeadline: Date | null;
  cancelledBy: "customer" | "business" | null;
  /** The business's contact details to show the customer, or null when the owner has turned this off. */
  contact: { email: string | null; phone: string | null } | null;
};

export type Rendered = { subject: string; text: string; html: string };

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Subjects must be a single line: strips CR/LF so user text can never inject headers. */
export const oneLine = (s: string) => s.replace(/[\r\n\u2028\u2029]+/g, " ").trim().slice(0, 200);

type Row = [label: string, value: string];

function details(d: EmailData, recipient: Recipient): Row[] {
  const price = d.depositPence > 0
    ? `${formatPence(d.pricePence)} (deposit ${formatPence(d.depositPence)}${d.depositStatus === "paid" ? ", paid" : ""})`
    : formatPence(d.pricePence);
  const rows: Row[] = [
    ["Service", d.serviceName],
    ["When", `${formatDateTime(d.startsAt, d.tz)} to ${formatTime(d.endsAt, d.tz)} (UK time)`],
    ["With", d.staffName],
    ["Price", price],
  ];
  if (recipient === "business") {
    rows.unshift(["Customer", d.customerName]);
    if (d.customerEmail) rows.push(["Email", d.customerEmail]);
    if (d.customerPhone) rows.push(["Phone", d.customerPhone]);
  } else if (d.contact && (d.contact.email || d.contact.phone)) {
    rows.push([`Contact ${d.businessName}`, [d.contact.email, d.contact.phone].filter(Boolean).join(" · ")]);
  }
  return rows;
}

function layout(heading: string, intro: string, rows: Row[], links: Row[], footer: string): Omit<Rendered, "subject"> {
  const text = [
    heading, "", intro, "",
    ...rows.map(([k, v]) => `${k}: ${v}`), "",
    ...links.map(([k, v]) => `${k}: ${v}`), ...(links.length ? [""] : []),
    footer,
  ].join("\n");

  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#171717;line-height:1.5;max-width:560px;margin:0 auto;padding:16px">
<h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(heading)}</h1>
<p>${escapeHtml(intro)}</p>
<table role="presentation" style="border-collapse:collapse;width:100%;margin:12px 0">
${rows.map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#525252;vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:6px 0">${escapeHtml(v)}</td></tr>`).join("\n")}
</table>
${links.map(([k, v]) => `<p><a href="${escapeHtml(v)}">${escapeHtml(k)}</a></p>`).join("\n")}
<p style="color:#525252;font-size:13px">${escapeHtml(footer)}</p>
</body></html>`;
  return { text, html };
}

/** What happened to the deposit, when there was one. */
function depositSentence(d: EmailData): string {
  if (d.depositPence <= 0) return "";
  const amount = formatPence(d.depositPence);
  if (d.depositStatus === "refunded") return ` Your deposit of ${amount} has been refunded to your card. It can take 5 to 10 days to appear.`;
  if (d.depositStatus === "paid") return ` Your deposit of ${amount} will be refunded to your card.`;
  if (d.depositStatus === "retained") return ` ${d.businessName} has kept your deposit of ${amount}.`;
  return "";
}

export function renderEmail(kind: EmailKind, recipient: Recipient, d: EmailData): Rendered {
  const when = formatDateTime(d.startsAt, d.tz);
  const rows = details(d, recipient);

  if (recipient === "business") {
    const link: Row[] = [["Open this booking", d.dashboardUrl]];
    const foot = `Sent by your booking page for ${d.businessName}.`;
    if (kind === "confirmation") {
      return { subject: oneLine(`New booking: ${d.customerName}, ${d.serviceName}, ${when}`),
        ...layout("New booking", `${d.customerName} has booked ${d.serviceName}.`, rows, link, foot) };
    }
    return { subject: oneLine(`Booking cancelled by customer: ${d.customerName}, ${when}`),
      ...layout("Booking cancelled", `${d.customerName} has cancelled their booking. The time is free again.`, rows, link, foot) };
  }

  const foot = `This message is about your booking with ${d.businessName}. Reply to this email to contact them.`;
  const manage: Row[] = [["View or cancel your booking", d.manageUrl]];
  const deadline = d.cancelDeadline
    ? `You can cancel online until ${formatDateTime(d.cancelDeadline, d.tz)}. After that, please contact ${d.businessName} directly.`
    : `To cancel, please contact ${d.businessName} directly.`;

  switch (kind) {
    case "confirmation":
      return { subject: oneLine(`Booking confirmed: ${d.serviceName} on ${when}`),
        ...layout("Your booking is confirmed", `Hi ${d.customerName}, your booking with ${d.businessName} is confirmed. ${deadline}`, rows, manage, foot) };
    case "reminder":
      return { subject: oneLine(`Reminder: ${d.serviceName} at ${formatTime(d.startsAt, d.tz)} (${when})`),
        ...layout("Appointment reminder", `Hi ${d.customerName}, this is a reminder of your booking with ${d.businessName}. ${deadline}`, rows, manage, foot) };
    case "reschedule":
      return { subject: oneLine(`Your booking has moved: ${d.serviceName} on ${when}`),
        ...layout("Your booking has moved", `Hi ${d.customerName}, ${d.businessName} has moved your booking to a new time. The new details are below.`, rows, manage, foot) };
    case "cancellation": {
      const who = (d.cancelledBy === "business" ? `${d.businessName} has cancelled your booking.` : "You have cancelled your booking.") + depositSentence(d);
      return { subject: oneLine(`Booking cancelled: ${d.serviceName} on ${when}`),
        ...layout("Your booking is cancelled", `Hi ${d.customerName}, ${who}`, rows, [], foot) };
    }
  }
}
