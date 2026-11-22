import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { acceptsBookings, getBusinessBySlug, listBookableServices, listOpeningTimes, listShopPhotos, logoUrl } from "@/lib/booking/data";
import { formatPence } from "@/lib/money";
import { groupedOpeningTimes } from "@/lib/opening-hours";
import { shopBase } from "@/lib/shop-base";
import { shopPageEnabled } from "@/lib/shop-page-switch";
import { mapEmbedUrl, mapLinkUrl } from "@/lib/validation/shop-page";
import { PublicShell } from "./chrome";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const business = await getBusinessBySlug((await params).slug);
  return business ? { title: business.name, description: business.about?.slice(0, 160) } : { title: "Not found" };
}

const H2 = "text-xl font-semibold tracking-tight";
const CARD = "rounded-2xl border border-[color:var(--brand-line,#dfe5da)] bg-white p-6";
const BUTTON = "inline-flex min-h-12 items-center justify-center rounded-lg bg-[color:var(--brand,#215b48)] px-6 text-base font-semibold text-[color:var(--brand-on,#fff)] transition hover:bg-[color:var(--brand-hover,#1a4a3a)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring,#397451)] focus-visible:ring-offset-2";

export default async function ShopPage({ params }: Props) {
  const business = await getBusinessBySlug((await params).slug);
  if (!business) notFound();
  const base = await shopBase(business.slug);
  // Until the front page is switched on, the shop's address opens the service list as before.
  const show = new Set(business.shop_page_show ?? []);
  if (!shopPageEnabled() || show.size === 0) redirect(`${base}/services`);

  const open = acceptsBookings(business);
  const on = (k: string) => show.has(k);
  const [photos, days, services] = await Promise.all([
    on("cover") || on("gallery") ? listShopPhotos(business.id) : Promise.resolve([]),
    on("hours") ? listOpeningTimes(business.id) : Promise.resolve([]),
    open && on("services") ? listBookableServices(business.id) : Promise.resolve([]),
  ]);
  const hours = groupedOpeningTimes(days);
  const anyHours = days.some((d) => d.ranges.length);
  const cover = on("cover") ? photos[0] : undefined;
  const gallery = on("gallery") ? photos.slice(on("cover") ? 1 : 0) : [];
  const phoneHref = business.contact?.phone ? `tel:${business.contact.phone.replace(/[^+\d]/g, "")}` : null;

  return (
    <PublicShell accent={business.accent_color} base={base} name={business.name} logo={logoUrl(business.logo_path)} privacyUrl={business.privacy_notice_url} wide>
      <section aria-labelledby="shop-h">
        {on("cover") && <div className="overflow-hidden rounded-2xl bg-[color:var(--brand-soft,#edf1e7)]">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover.url} alt={`${business.name}`} className="aspect-[16/8] w-full object-cover" />
          ) : (
            <div aria-hidden="true" className="flex aspect-[16/6] w-full items-center justify-center text-6xl font-semibold text-[color:var(--brand,#215b48)]/40">{business.name.trim().charAt(0).toUpperCase()}</div>
          )}
        </div>}
        <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 id="shop-h" className="text-[32px] font-semibold leading-tight tracking-[-1px]">{business.name}</h1>
            {on("map") && business.address && <p className="mt-2 text-[color:var(--brand-muted,#6b756d)]">{business.address}</p>}
          </div>
          <div className="flex flex-wrap gap-3">
            {open ? <Link href={`${base}/services`} className={BUTTON}>Book now</Link> : null}
            {phoneHref && <a href={phoneHref} className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[color:var(--brand-border,#789467)] bg-white px-5 text-base font-medium text-[color:var(--brand-text,#36543c)]">Call {business.contact?.phone}</a>}
          </div>
        </div>
        {!open && <p className="mt-5 rounded-xl bg-[color:var(--brand-soft,#edf1e7)] p-5 text-sm">Online booking isn&apos;t available right now. Please contact {business.name} directly.</p>}
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-8">
          {on("about") && business.about && (
            <section aria-labelledby="about-h" className={CARD}>
              <h2 id="about-h" className={H2}>About</h2>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-7">{business.about}</p>
            </section>
          )}
          {services.length > 0 && (
            <section aria-labelledby="services-h" className={CARD}>
              <h2 id="services-h" className={H2}>Services</h2>
              <ul className="mt-3 divide-y divide-[color:var(--brand-line,#e5eadf)]">
                {services.slice(0, 6).map((s) => (
                  <li key={s.id}>
                    <Link href={`${base}/book/${s.id}`} className="flex min-h-14 items-center justify-between gap-4 py-3 hover:text-[color:var(--brand,#215b48)]">
                      <span className="min-w-0">
                        <span className="block font-medium">{s.name}</span>
                        <span className="block text-sm text-[color:var(--brand-muted,#6b756d)]">{s.duration_minutes} minutes</span>
                      </span>
                      <span className="shrink-0 font-semibold">{s.price_varies ? `from ${formatPence(s.from_pence)}` : formatPence(s.from_pence)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href={`${base}/services`} className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-[color:var(--brand,#215b48)] hover:underline">{services.length > 6 ? "See all services and book →" : "Choose a service and book →"}</Link>
            </section>
          )}
          {on("info") && business.additional_info && (
            <section aria-labelledby="info-h" className={CARD}>
              <h2 id="info-h" className={H2}>Additional information</h2>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-7">{business.additional_info}</p>
            </section>
          )}
        </div>

        <div className="space-y-8">
          {anyHours && (
            <section aria-labelledby="hours-h" className={CARD}>
              <h2 id="hours-h" className={H2}>Opening times</h2>
              <dl className="mt-3 space-y-2 text-[15px]">
                {hours.map((h) => (
                  <div key={h.label} className="flex justify-between gap-4">
                    <dt className="font-medium">{h.label}</dt>
                    <dd className="text-right text-[color:var(--brand-muted,#6b756d)]">{h.text}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          {on("map") && business.address && (
            <section aria-labelledby="map-h" className={`${CARD} overflow-hidden`}>
              <h2 id="map-h" className={H2}>Find us</h2>
              <p className="mt-2 text-[15px]">{business.address}</p>
              <iframe title={`Map of ${business.name}`} src={mapEmbedUrl(business.address)} loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                className="mt-4 h-64 w-full rounded-xl border-0" />
              <a href={mapLinkUrl(business.address)} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-[color:var(--brand,#215b48)] hover:underline">Get directions →</a>
            </section>
          )}
        </div>
      </div>

      {gallery.length > 0 && (
        <section aria-labelledby="gallery-h" className="mt-10">
          <h2 id="gallery-h" className={H2}>Gallery</h2>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {gallery.map((p, i) => (
              <li key={p.id}>
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring,#397451)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={`${business.name} photo ${i + 2}`} loading="lazy" className="aspect-[4/3] w-full object-cover transition hover:scale-[1.03]" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {open && (
        <div className="mt-12 text-center">
          <Link href={`${base}/services`} className={BUTTON}>Book now</Link>
        </div>
      )}
    </PublicShell>
  );
}
