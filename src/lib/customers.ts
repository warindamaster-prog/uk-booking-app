/** Keeps only characters that are safe inside a PostgREST filter and a LIKE pattern. */
export function safeSearchTerm(q: string | undefined | null): string {
  return (q ?? "").replace(/[^\p{L}\p{N} @.'+-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

export type ExportInput = {
  businessName: string;
  exportedAt: Date;
  customer: {
    name: string; email: string | null; phone: string | null;
    marketing_consent: boolean; marketing_consent_at: string | null; created_at: string;
  };
  bookings: {
    service_name: string; staffName: string; starts_at: string; ends_at: string; status: string;
    price_pence: number; deposit_pence: number; deposit_status: string;
    created_at: string; cancelled_at: string | null; cancelled_by: string | null;
  }[];
  emails: { kind: string; status: string; sent_at: string | null; created_at: string }[];
};

/**
 * A customer's personal data in a portable, readable form (a "subject access" copy).
 * Deliberately limited to what the customer gave us or what concerns them: internal ids, payment
 * and security fields (links, Stripe ids) are never included.
 */
export function buildCustomerExport(i: ExportInput) {
  return {
    exportedAt: i.exportedAt.toISOString(),
    dataController: i.businessName,
    note: "Times are in UTC (ISO 8601). Prices are in pence (GBP).",
    customer: {
      name: i.customer.name,
      email: i.customer.email,
      phone: i.customer.phone,
      marketingEmailsConsent: i.customer.marketing_consent,
      marketingConsentGivenAt: i.customer.marketing_consent_at,
      firstRecordedAt: i.customer.created_at,
    },
    bookings: i.bookings.map((b) => ({
      service: b.service_name, with: b.staffName, startsAt: b.starts_at, endsAt: b.ends_at, status: b.status,
      pricePence: b.price_pence, depositPence: b.deposit_pence, depositStatus: b.deposit_status,
      bookedAt: b.created_at, cancelledAt: b.cancelled_at, cancelledBy: b.cancelled_by,
    })),
    emailsSentToCustomer: i.emails.map((e) => ({ type: e.kind, status: e.status, sentAt: e.sent_at, createdAt: e.created_at })),
  };
}

export function exportFilename(customerId: string, now: Date): string {
  return `customer-data-${customerId.slice(0, 8)}-${now.toISOString().slice(0, 10)}.json`;
}
