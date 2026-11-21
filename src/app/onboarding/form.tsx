"use client";

import { useActionState, useRef, useState } from "react";
import { createBusiness } from "./actions";
import { Field, FormError, SubmitButton } from "@/components/ui";
import type { FormState } from "@/lib/form";
import { formatPence } from "@/lib/money";
import { grossPence, isValidSeats, isValidSmsPacks, PRICING, pricePence, smsPackPricePence, threeYearSavingVsMonthlyPence, vatPence, yearlySavingPence, type PlanInterval } from "@/lib/pricing";
import { slugify } from "@/lib/slug";
import { useT } from "@/lib/i18n/client";

const STEP1_FIELDS = ["name", "slug", "ownerName", "email", "phone", "logo"];
const STEP1_REQUIRED: Record<string, string> = {
  name: "Enter your business name",
  slug: "Use 3-40 letters, numbers or hyphens, starting with a letter or number",
  ownerName: "Enter the owner's name",
  email: "Enter a valid email address",
  phone: "Enter a valid phone number, for example 07700 900123",
};

export function OnboardingForm({ siteHost, noTrial = false, smsEnabled = false, threeYearOn = false }: { siteHost: string; noTrial?: boolean; smsEnabled?: boolean; threeYearOn?: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState<FormState, FormData>(createBusiness, {});
  const v = state.values ?? {};
  const [slug, setSlug] = useState<string | null>(null); // null = follow the business name
  const [name, setName] = useState(v.name ?? "");
  const [seatsText, setSeatsText] = useState(v.seats ?? "1");
  const [chosen, setInterval] = useState<PlanInterval>(v.interval === "year" ? "year" : v.interval === "three_year" && threeYearOn ? "three_year" : "month");
  const shownSlug = slug ?? v.slug ?? slugify(name);
  const [smsOn, setSmsOn] = useState(v.smsOn === "on");
  const [packsText, setPacksText] = useState(v.smsPacks && v.smsPacks !== "0" ? v.smsPacks : "1");

  const seats = /^\d+$/.test(seatsText) ? Number(seatsText) : NaN;
  const seatsOk = isValidSeats(seats);
  // The 3-year plan needs at least 3 staff: with fewer the card is greyed out and the choice falls back to monthly.
  const threeYearOk = threeYearOn && seatsOk && seats >= PRICING.threeYearMinSeats;
  const interval: PlanInterval = chosen === "three_year" && !threeYearOk ? "month" : chosen;
  const packsN = /^\d+$/.test(packsText) ? Number(packsText) : NaN;
  const packs = smsEnabled && smsOn && interval !== "three_year" && isValidSmsPacks(packsN) ? packsN : 0;
  const e = state.fieldErrors ?? {};

  // Two steps in one form: your business, then your plan. Nothing is saved until the last button.
  const [step, setStep] = useState<1 | 2>(1);
  const [local, setLocal] = useState<Record<string, string[]>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const [seen, setSeen] = useState(state);
  if (state !== seen) { // a reply from the server: go to the step that has the problem
    setSeen(state);
    if (Object.keys(state.fieldErrors ?? {}).some((k) => STEP1_FIELDS.includes(k))) setStep(1);
    else if (state.fieldErrors || state.error) setStep(2);
  }
  const err = (k: string) => e[k] ?? local[k];

  function next() {
    const data = new FormData(formRef.current!);
    const missing: Record<string, string[]> = {};
    for (const [k, msg] of Object.entries(STEP1_REQUIRED)) if (!String(data.get(k) ?? "").trim()) missing[k] = [msg];
    setLocal(missing);
    if (Object.keys(missing).length) return;
    setStep(2);
    window.scrollTo({ top: 0 });
  }

  return (
    <form ref={formRef} action={action} className="space-y-5" noValidate>
      <FormError message={state.error} />
      <p className="text-sm text-[#6b756d]" aria-live="polite">{t("Step {n} of 2", { n: step })}: {t(step === 1 ? "Your business" : "Choose your plan")}</p>

      <div hidden={step !== 1} className="space-y-5" onKeyDown={(ev) => { if (ev.key === "Enter" && (ev.target as HTMLElement).tagName === "INPUT") { ev.preventDefault(); next(); } }}>

      <Field label="Business name" name="name" required maxLength={100} autoComplete="organization"
        defaultValue={v.name} errors={err("name")} onChange={(ev) => setName(ev.target.value)} />
      <Field label="Web address" name="slug" required value={shownSlug}
        onChange={(ev) => setSlug(ev.target.value.toLowerCase())}
        hint={t("Your booking page: {url}", { url: `${siteHost}/b/${shownSlug || "your-name"}` })}
        errors={err("slug")} autoCapitalize="none" spellCheck={false} />
      <Field label="Owner's name" name="ownerName" required maxLength={100} autoComplete="name"
        hint="Shown to customers if you take bookings yourself." defaultValue={v.ownerName} errors={err("ownerName")} />
      <Field label="Contact email" name="email" type="email" required autoComplete="email" inputMode="email"
        hint="Booking notifications are sent here. Customers also see it, and your phone number, in their booking emails; you can turn that off later in Settings." defaultValue={v.email} errors={err("email")} />
      <Field label="Phone number" name="phone" type="tel" required autoComplete="tel" inputMode="tel"
        defaultValue={v.phone} errors={err("phone")} />
      <div className="space-y-1">
        <span className="block text-sm font-medium">{t("Time zone")}</span>
        <p className="rounded-lg border border-stone-200 bg-[#f7f8f4] px-3 py-3">{t("Europe/London (UK time)")}</p>
      </div>
      <Field label="Logo (optional)" name="logo" type="file" accept="image/png,image/jpeg,image/webp"
        hint="PNG, JPEG or WebP, up to 2 MB." errors={e.logo} />
        <button type="button" onClick={next} className="min-h-12 w-full rounded-lg bg-[#34553e] px-4 py-3 text-base font-semibold text-white transition hover:bg-[#25422e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#397451] focus-visible:ring-offset-2">{t("Continue")} →</button>
      </div>

      <div hidden={step !== 2} className="space-y-5">
        <Field label="How many staff will take bookings? (include yourself)" name="seats" inputMode="numeric" required
          value={seatsText} onChange={(ev) => setSeatsText(ev.target.value)}
          hint={t("Include yourself if you take bookings. {base} a month for one person, then {extra} a month for each extra person. You can change this later.", { base: formatPence(PRICING.baseMonthlyPence), extra: formatPence(PRICING.extraSeatMonthlyPence) })}
          errors={e.seats} />

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-[#2d4a38]">{t("Billing")}</legend>
          <div className="space-y-2">
            {((threeYearOn ? ["month", "year", "three_year"] : ["month", "year"]) as PlanInterval[]).map((i) => {
              const off = i === "three_year" && !threeYearOk;
              const price = seatsOk && !off ? pricePence(seats, i, i === "three_year" ? 0 : packs) : null;
              return (
                <label key={i} className={`flex items-start gap-3 rounded-xl border p-4 transition ${interval === i ? "border-[#34553e] bg-[#eef3e9]" : "border-stone-200 bg-white"} ${off ? "opacity-60" : ""}`}>
                  <input type="radio" name="interval" value={i} checked={interval === i} disabled={off}
                    onChange={() => setInterval(i)} className="mt-1 h-5 w-5 accent-[#34553e]" />
                  <span>
                    <span className="block font-medium">{t(i === "month" ? "Monthly" : i === "year" ? "Yearly (12 months for the price of 10)" : "3-year prepaid: 35% off")}</span>
                    <span className="block text-sm">
                      {i === "three_year" && off ? t("Needs at least {n} staff.", { n: PRICING.threeYearMinSeats })
                        : price === null ? t("Enter the number of people to see the price")
                        : i === "three_year" ? t("{price} + VAT, paid once for 3 years", { price: formatPence(price) })
                        : t("{price} + VAT per {interval}", { price: formatPence(price), interval: t(i) })}
                      {price !== null && i === "year" && ` (${t("save {amount}", { amount: formatPence(yearlySavingPence(seats)) })})`}
                      {price !== null && i === "three_year" && ` (${t("save {amount}", { amount: formatPence(threeYearSavingVsMonthlyPence(seats)) })})`}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          {e.interval && <p className="mt-1 text-sm text-red-700 dark:text-red-400">{t(e.interval[0])}</p>}
        </fieldset>

        {smsEnabled && interval !== "three_year" && (
        <div className="space-y-2">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="smsOn" checked={smsOn} onChange={(ev) => setSmsOn(ev.target.checked)} className="mt-1 h-5 w-5 accent-[#34553e]" />
            <span>
              <span className="block font-medium">Send SMS booking confirmations (optional)</span>
              <span className="block text-neutral-600 dark:text-neutral-400">
                {formatPence(PRICING.smsPackMonthlyPence)} + VAT a month for each pack of {PRICING.smsPackTexts} texts
                {interval === "year" ? ` (${formatPence(smsPackPricePence("year"))} + VAT a year)` : ""}. You can add or remove packs later.
              </span>
            </span>
          </label>
          {smsOn && (
            <Field label="SMS packs" name="smsPacks" inputMode="numeric" value={packsText} onChange={(ev) => setPacksText(ev.target.value)}
              hint={`${isValidSmsPacks(packsN) ? packsN * PRICING.smsPackTexts : "…"} texts a month. Texts start sending once we switch SMS on.${noTrial ? "" : " You are not charged before then."}`}
              errors={e.smsPacks} />
          )}
        </div>
        )}

        <div role="status" aria-live="polite" className="rounded-xl bg-[#edf2e1] p-4 text-sm text-[#2d4a38]">
          <p className="font-medium">{noTrial ? t("No free trial. You subscribe after setting up, and your booking page opens once you have.") : t("Free for {days} days. No card needed.", { days: PRICING.trialDays })}</p>
          {seatsOk && (() => {
            const net = pricePence(seats, interval, packs);
            if (interval === "three_year") {
              return <p>{t("You pay once, after the trial: {net} + {vat} VAT = {gross} for 3 years. Nothing is charged automatically, and you can pay any time from Billing.", { net: formatPence(net), vat: formatPence(vatPence(net)), gross: formatPence(grossPence(net)) })}</p>;
            }
            return <p>{t(noTrial ? "Your plan" : "After the trial")}: {t("{net} + {vat} VAT = {gross} per {interval}.", { net: formatPence(net), vat: formatPence(vatPence(net)), gross: formatPence(grossPence(net)), interval: t(interval) })}</p>;
          })()}
        </div>
        <SubmitButton pending={pending}>{t(noTrial ? "Set up my business" : "Start my free trial")}</SubmitButton>
        <button type="button" onClick={() => { setStep(1); window.scrollTo({ top: 0 }); }} className="flex min-h-11 w-full items-center justify-center rounded-lg text-sm font-medium text-[#415044] hover:bg-[#f1f5ed]">← {t("Back")}</button>
      </div>
    </form>
  );
}
