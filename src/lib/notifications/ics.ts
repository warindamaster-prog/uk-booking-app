// Minimal RFC 5545 calendar file. Times are UTC, lines are CRLF-terminated and folded at 75 octets.

export type IcsInput = {
  uid: string;
  /** Bumped for every change to the same booking so calendar apps update the event instead of duplicating it. */
  sequence: number;
  method: "PUBLISH" | "CANCEL";
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  url?: string;
  now: Date;
};

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

/** Escapes a TEXT value: backslash, semicolon, comma and newlines; drops other control characters. */
export function escapeIcsText(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Folds a content line to at most 75 octets per physical line, never splitting a character. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
      limit = 74; // continuation lines start with a space, which counts as one octet
    }
    current += ch;
    bytes += n;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function buildIcs(i: IcsInput): string {
  const cancelled = i.method === "CANCEL";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Booking//Appointments//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${i.method}`,
    "BEGIN:VEVENT",
    `UID:${i.uid}`,
    `DTSTAMP:${stamp(i.now)}`,
    `SEQUENCE:${i.sequence}`,
    `DTSTART:${stamp(i.start)}`,
    `DTEND:${stamp(i.end)}`,
    `SUMMARY:${escapeIcsText(i.summary)}`,
    ...(i.description ? [`DESCRIPTION:${escapeIcsText(i.description)}`] : []),
    ...(i.url ? [`URL:${i.url}`] : []),
    `STATUS:${cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
