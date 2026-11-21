import type { Metadata } from "next";
import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { safeSearchTerm } from "@/lib/customers";
import { formatDate } from "@/lib/time";
import { intlLocale } from "@/lib/i18n/core";
import { getLocale, getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Customers" };

const PAGE_SIZE = 25;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase, business } = await requireOwner();
  const t = await getT();
  const loc = intlLocale(await getLocale());
  const raw = await searchParams;
  const val = (k: string) => (Array.isArray(raw[k]) ? raw[k][0] : raw[k]);
  const q = safeSearchTerm(val("q"));
  const page = Math.max(1, Number.parseInt(val("page") ?? "1", 10) || 1);

  let query = supabase.from("customers").select("id, name, email, phone, created_at", { count: "exact" })
    .eq("business_id", business.id).is("anonymised_at", null);
  if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%`);
  const { data: customers, count } = await query.order("name").range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const ids = (customers ?? []).map((c) => c.id);
  const { data: bookings } = ids.length
    ? await supabase.from("bookings").select("customer_id, starts_at, status").eq("business_id", business.id).in("customer_id", ids)
    : { data: [] };
  const stats = new Map<string, { count: number; last: string | null }>();
  for (const b of bookings ?? []) {
    if (b.status === "cancelled" || b.status === "expired") continue;
    const s = stats.get(b.customer_id) ?? { count: 0, last: null };
    s.count++;
    if (!s.last || b.starts_at > s.last) s.last = b.starts_at;
    stats.set(b.customer_id, s);
  }

  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const href = (pg: number) => `/dashboard/customers?${new URLSearchParams({ ...(q ? { q } : {}), ...(pg > 1 ? { page: String(pg) } : {}) })}`;
  const deleted = val("deleted") === "1";

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("Customers")}</h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {t("People who have booked with you. You can download a copy of a customer's data or delete their personal details if they ask.")}
      </p>
      {deleted && <p role="status" className="rounded-md border border-green-700 p-3 text-sm text-green-800 dark:text-green-400">{t("The customer's personal details were deleted.")}</p>}

      <form method="get" role="search" className="flex gap-2">
        <label htmlFor="q" className="sr-only">{t("Search by name or email")}</label>
        <input id="q" name="q" type="search" defaultValue={q} placeholder={t("Search by name or email")} maxLength={60}
          className="min-h-11 grow rounded-md border border-neutral-400 bg-transparent px-3 py-2" />
        <button type="submit" className="min-h-11 rounded-md border border-neutral-400 px-4 text-sm">{t("Search")}</button>
      </form>

      {customers?.length ? (
        <ul className="divide-y divide-neutral-300 rounded-md border border-neutral-300 dark:divide-neutral-700 dark:border-neutral-700">
          {customers.map((c) => {
            const s = stats.get(c.id);
            return (
              <li key={c.id}>
                <Link href={`/dashboard/customers/${c.id}`} className="block p-3 hover:bg-neutral-50 dark:hover:bg-neutral-900">
                  <span className="block font-medium">{c.name}</span>
                  <span className="block text-sm text-neutral-600 dark:text-neutral-400">
                    {[c.email, c.phone].filter(Boolean).join(" · ")}
                  </span>
                  <span className="block text-sm text-neutral-600 dark:text-neutral-400">
                    {s ? t(s.count === 1 ? "1 booking, latest {date}" : "{n} bookings, latest {date}", { n: s.count, date: formatDate(s.last!, business.timezone, loc) }) : t("No active bookings")}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : <p>{q ? t("No customers match that search.") : t("No customers yet. They appear here after their first booking.")}</p>}

      {pages > 1 && (
        <nav aria-label={t("Pages")} className="flex items-center justify-between text-sm">
          {page > 1 ? <Link href={href(page - 1)} className="underline">{t("← Previous")}</Link> : <span />}
          <span>{t("Page {page} of {pages}", { page, pages })}</span>
          {page < pages ? <Link href={href(page + 1)} className="underline">{t("Next →")}</Link> : <span />}
        </nav>
      )}
    </main>
  );
}
