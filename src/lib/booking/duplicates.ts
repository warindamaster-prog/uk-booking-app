// "Has this person already booked?" check on the public booking form.
//
// Two bookings are treated as the same person's when the NAME and the PHONE NUMBER match
// (ignoring case, spacing and the +44 / 0 prefix). If they do, the customer is asked to confirm
// before booking another. The service is only mentioned when the EMAIL matches too: naming it to
// anyone who merely knows a name and number would tell them what someone else has booked.

/** "+44 (0)7700 900123", "0044 7700 900123" and "07700 900123" all become "07700900123". */
export function normalizePhone(raw: string): string {
  let s = raw.replace(/\(0\)/g, "").replace(/[^\d+]/g, "");
  if (s.startsWith("+44")) s = "0" + s.slice(3);
  else if (s.startsWith("0044")) s = "0" + s.slice(4);
  else if (s.startsWith("44") && s.length >= 12) s = "0" + s.slice(2);
  return s.replace(/\D/g, "");
}

export function normalizeName(raw: string): string {
  return raw.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Escapes % _ and \ so a name can be used as an exact (case-insensitive) ILIKE pattern. */
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export type KnownCustomer = { id: string; name: string; email: string | null; phone: string | null };
export type UpcomingBooking = { customer_id: string; service_name: string; starts_at: string };

export type DuplicateFound = {
  /** Only set when the email matches as well. */
  serviceName: string | null;
  sameEmail: boolean;
};

/**
 * Finds an upcoming booking by the same name and phone. `customers` are candidates the database
 * already narrowed by name; `bookings` are their upcoming live bookings.
 */
export function findDuplicate(
  input: { name: string; phone: string; email: string },
  customers: KnownCustomer[],
  bookings: UpcomingBooking[],
): DuplicateFound | null {
  const name = normalizeName(input.name);
  const phone = normalizePhone(input.phone);
  if (!phone) return null;

  const same = customers.filter((c) => normalizeName(c.name) === name && c.phone && normalizePhone(c.phone) === phone);
  const ids = new Set(same.map((c) => c.id));
  const upcoming = bookings
    .filter((b) => ids.has(b.customer_id))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  if (!upcoming) return null;

  const customer = same.find((c) => c.id === upcoming.customer_id)!;
  const sameEmail = !!customer.email && customer.email.toLowerCase() === input.email.toLowerCase();
  return { serviceName: sameEmail ? upcoming.service_name : null, sameEmail };
}

export function duplicateMessage(d: DuplicateFound, businessName: string): string {
  return d.serviceName
    ? `This name and phone number already have an upcoming booking for ${d.serviceName}. Do you want to book another?`
    : `This name and phone number already have an upcoming booking with ${businessName}. Do you want to book another?`;
}
