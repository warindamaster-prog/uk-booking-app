import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { acceptsBookings, getBusinessBySlug, listBookableServices, listOpeningTimes, listShopPhotos, logoUrl } from "@/lib/booking/data";
import { formatPence } from "@/lib/money";
import { groupedOpeningTimes, openingTimesFromOwn } from "@/lib/opening-hours";
import { shopBase } from "@/lib/shop-base";
import { shopPageEnabled } from "@/lib/shop-page-switch";
import { mapEmbedUrl, mapLinkUrl } from "@/lib/validation/shop-page";
import { PublicShell } from "./chrome";
import { HeroPhotos, PhotoGrid } from "./shop-photos";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const business = await getBusinessBySlug((await params).slug);
  return business ? { title: business.name, description: business.about?.slice(0, 160) } : { title: "Not found" };
}

const H2 = "font-serif text-3xl tracking-[-0.5px]";
const MUTED = "text-[color:var(--brand-muted,#57635a)]";
const EYEBROW = "mb-3 text-xs font-medium uppercase tracking-[2px] text-[color:var(--brand-text,#617354)]";
const BTN = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring,#58714c)] focus-visible:ring-offset-2";
const BTN_MAIN = `${BTN} bg-[color:var(--brand,#344f3c)] text-[color:var(--brand-on,#fff)] hover:bg-[color:var(--brand-hover,#263e2c)]`;
const BTN_LINE = `${BTN} border border-[color:var(--brand-line,#dfe4d7)] bg-white hover:bg-[color:var(--brand-softer,#f4f6ef)]`;

const Pin = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></svg>
);

export default async function ShopPage({ params }: Props) {
  const business = await getBusinessBySlug((await params).slug);
  if (!business) notFound();
  const base = await shopBase(business.slug);
  // No front page (switched off, or the shop ticked nothing): the shop's address opens the service list.
  const show = new Set(business.shop_page_show ?? []);
  if (!shopPageEnabled() || show.size === 0) redirect(`${base}/services`);
  const on = (k: string) => show.has(k);

  const open = acceptsBookings(business);
  const [photos, days, services] = await Promise.all([
    on("cover") || on("gallery") ? listShopPhotos(business.id) : Promise.resolve([]),
    !on("hours") ? Promise.resolve([]) : Array.isArray(business.shop_hours) ? Promise.resolve(openingTimesFromOwn(business.shop_hours)) : listOpeningTimes(business.id),
    open && on("services") ? listBookableServices(business.id) : Promise.resolve([]),
  ]);
  const hours = groupedOpeningTimes(days);
  const showHours = on("hours") && days.some((d) => d.ranges.length);
  const showAbout = on("about") && !!business.about;
  const showInfo = on("info") && !!business.additional_info;
  const showMap = on("map") && !!business.address;
  const showGallery = on("gallery") && photos.length > 0;
  const showServices = services.length > 0;
  const lowest = services.length ? Math.min(...services.map((s) => s.from_pence)) : null;

  const nav = [
    showServices && ["Services", "services"], showAbout && ["About", "about"], showGallery && ["Gallery", "gallery"],
    showHours && ["Opening times", "opening-times"], showMap && ["Location", "location"],
  ].filter(Boolean) as [string, string][];

  return (
    <PublicShell accent={business.accent_color} base={base} name={business.name} logo={logoUrl(business.logo_path)} privacyUrl={business.privacy_notice_url} wide>
      {on("cover") && photos.length > 0 && <HeroPhotos photos={photos} name={business.name} />}

      <div className={`grid gap-10 pb-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12 ${on("cover") && photos.length ? "pt-8" : "pt-2"}`}>
        <div className="min-w-0">
          <section className="pb-7">
            <h1 className="font-serif text-5xl tracking-[-1.5px] md:text-6xl">{business.name}</h1>
            {showMap && (
              <a href="#location" className={`mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm hover:underline ${MUTED}`}><Pin />{business.address}</a>
            )}
          </section>

          {nav.length > 1 && (
            <nav aria-label="Sections" className="mb-9 flex gap-6 overflow-x-auto border-b border-[color:var(--brand-line,#dfe4d7)] text-sm font-medium">
              {nav.map(([label, id], i) => (
                <a key={id} href={`#${id}`} className={`flex min-h-14 shrink-0 items-center border-b-2 ${i === 0 ? "border-[color:var(--brand,#344f3c)] text-[color:var(--brand,#344f3c)]" : `border-transparent hover:border-[color:var(--brand-border,#aab99e)] ${MUTED}`}`}>{label}</a>
              ))}
            </nav>
          )}

          {showServices && (
            <section id="services" className="scroll-mt-6 pb-11">
              <div className="flex items-end justify-between gap-3"><h2 className={H2}>Our services</h2></div>
              <div className="mt-6 divide-y divide-[color:var(--brand-line,#e4e7de)] rounded-xl border border-[color:var(--brand-line,#e0e5d9)] bg-white/60 px-5">
                {services.map((s) => (
                  <article key={s.id} className="flex items-center justify-between gap-4 py-6">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold">{s.name}</h3>
                      <p className={`mt-1.5 text-sm ${MUTED}`}>{s.duration_minutes} min <span className="px-1.5">·</span> {s.price_varies ? "from " : ""}{formatPence(s.from_pence)}</p>
                      {s.description && <p className={`mt-2 max-w-md text-sm leading-6 ${MUTED}`}>{s.description}</p>}
                    </div>
                    <Link href={`${base}/book/${s.id}`} aria-label={`Book ${s.name}`} className={`${BTN} shrink-0 border border-[color:var(--brand-border,#d9e0d1)] bg-[color:var(--brand-softer,#f4f6ef)] !px-4 hover:bg-[color:var(--brand-soft,#e6eddf)]`}>Book</Link>
                  </article>
                ))}
              </div>
            </section>
          )}

          {showAbout && (
            <section id="about" className="scroll-mt-6 border-b border-[color:var(--brand-line,#e0e5d9)] pb-11">
              <p className={EYEBROW}>Get to know us</p>
              <h2 className={H2}>About {business.name}</h2>
              <p className={`mt-5 whitespace-pre-line text-sm leading-7 ${MUTED}`}>{business.about}</p>
            </section>
          )}

          {showGallery && (
            <section id="gallery" className="scroll-mt-6 py-11">
              <h2 className={`${H2} mb-5`}>A look around</h2>
              <PhotoGrid photos={photos} name={business.name} />
            </section>
          )}

          {(showHours || showInfo) && (
            <div className={`grid gap-9 border-y border-[color:var(--brand-line,#e0e5d9)] py-10 ${showHours && showInfo ? "md:grid-cols-2" : ""}`}>
              {showHours && (
                <section id="opening-times" className="scroll-mt-6">
                  <h2 className={`${H2} mb-6`}>Opening times</h2>
                  <dl className="space-y-4">
                    {hours.map((h) => (
                      <div key={h.label} className="flex justify-between gap-5 text-sm">
                        <dt className={MUTED}>{h.label}</dt>
                        <dd className={h.text === "Closed" ? MUTED : "font-medium"}>{h.text}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}
              {showInfo && (
                <section>
                  <h2 className={`${H2} mb-6`}>Additional information</h2>
                  <p className={`whitespace-pre-line text-sm leading-7 ${MUTED}`}>{business.additional_info}</p>
                </section>
              )}
            </div>
          )}

          {showMap && (
            <section id="location" className="scroll-mt-6 pt-11">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                <div><h2 className={H2}>Find us</h2><p className={`mt-3 text-sm ${MUTED}`}>{business.address}</p></div>
                <a href={mapLinkUrl(business.address!)} target="_blank" rel="noopener noreferrer" className={BTN_LINE}>Open map <span aria-hidden="true">→</span></a>
              </div>
              <iframe title={`Map of ${business.name}`} src={mapEmbedUrl(business.address!)} loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                className="h-72 w-full rounded-xl border border-[color:var(--brand-line,#dfe4d7)]" />
            </section>
          )}
        </div>

        <aside className="min-w-0 lg:pt-1">
          <div className="rounded-2xl border border-[color:var(--brand-line,#dce2d4)] bg-white p-6 shadow-[0_10px_40px_-22px_#46553c50] lg:sticky lg:top-6">
            <div aria-hidden="true" className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--brand-soft,#edf1e7)] font-serif text-3xl italic text-[color:var(--brand-text,#48613d)]">{business.name.trim().charAt(0).toLowerCase()}.</div>
            <p className={`text-xs uppercase tracking-[2px] ${MUTED}`}>Book with us</p>
            <h2 className="mt-3 font-serif text-3xl">Make time for you.</h2>
            <p className={`mt-3 text-sm leading-6 ${MUTED}`}>Find your service, choose your moment, and leave the rest to us.</p>
            {open ? (
              <Link href={`${base}/services`} className={`${BTN_MAIN} mt-6 w-full`}>Book an appointment <span aria-hidden="true">→</span></Link>
            ) : (
              <p className="mt-6 rounded-lg bg-[color:var(--brand-soft,#edf1e7)] p-4 text-sm">Online booking isn&apos;t available right now. Please contact {business.name} directly.</p>
            )}
            {lowest !== null && <p className={`mt-5 text-sm ${MUTED}`}>Services from {formatPence(lowest)}</p>}
            {(showMap || showHours) && (
              <div className="mt-6 space-y-1 border-t border-[color:var(--brand-line,#e5e9df)] pt-5">
                {showMap && <p className="flex items-center gap-2 text-sm font-medium"><Pin />{business.address}</p>}
                {showHours && <a href="#opening-times" className={`inline-flex min-h-11 items-center text-sm underline underline-offset-4 ${MUTED}`}>View opening times</a>}
              </div>
            )}
            {business.contact?.phone && (
              <a href={`tel:${business.contact.phone.replace(/[^+\d]/g, "")}`} className={`${BTN_LINE} mt-4 w-full`}>Call {business.contact.phone}</a>
            )}
          </div>
        </aside>
      </div>
    </PublicShell>
  );
}
