"use client";

import { useActionState, useState } from "react";
import { createBusiness } from "./actions";
import { Field, FormError, SubmitButton } from "@/components/ui";
import type { FormState } from "@/lib/form";
import { formatPence } from "@/lib/money";
import { grossPence, isValidSeats, isValidSmsPacks, PRICING, pricePence, smsPackPricePence, vatPence, yearlySavingPence, type BillingInterval } from "@/lib/pricing";
import { slugify } from "@/lib/slug";
import { useT } from "@/lib/i18n/client";

export function OnboardingForm({ siteHost, noTrial = false, smsEnabled = false }: { siteHost: string; noTrial?: boolean; smsEnabled?: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState<FormState, FormData>(createBusiness, {});
  const v = state.values ?? {};
  const [slug, setSlug] = useState<string | null>(null); // null = follow the business name
  const [name, setName] = useState(v.name ?? "");
  const [seatsText, setSeatsText] = useState(v.seats ?? "1");
  const [interval, setInterval] = useState<BillingInterval>(v.interval === "year" ? "year" : "month");
  const shownSlug = slug ?? v.slug ?? slugify(name);
  const [smsOn, setSmsOn] = useState(v.smsOn === "on");
  const [packsText, setPacksText] = useState(v.smsPacks && v.smsPacks !== "0" ? v.smsPacks : "1");

  const seats = /^\d+$/.test(seatsText) ? Number(seatsText) : NaN;
  const seatsOk = isValidSeats(seats);
  const packsN = /^\d+$/.test(packsText) ? Number(packsText) : NaN;
  const packs = smsEnabled && smsOn && isValidSmsPacks(packsN) ? packsN : 0;
  const e = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormError message={state.error} />

      <Field label="Business name" name="name" required maxLength={100} autoComplete="organization"
        defaultValue={v.name} errors={e.name} onChange={(ev) => setName(ev.target.value)} />
      <Field label="Web address" name="slug" required value={shownSlug}
        onChange={(ev) => setSlug(ev.target.value.toLowerCase())}
        hint={t("Your booking page: {url}", { url: `${siteHost}/b/${shownSlug || "your-name"}` })}
        errors={e.slug} autoCapitalize="none" spellCheck={false} />
      <Field label="Owner's name" name="ownerName" required maxLength={100} autoComplete="name"
        hint="Shown to customers if you take bookings yourself." defaultValue={v.ownerName} errors={e.ownerName} />
      <Field label="Contact email" name="email" type="email" required autoComplete="email" inputMode="email"
        hint="Booking notifications are sent here. Customers also see it, and your phone number, in their booking emails; you can turn that off later in Settings." defaultValue={v.email} errors={e.email} />
      <Field label="Phone number" name="phone" type="tel" required autoComplete="tel" inputMode="tel"
        defaultValue={v.phone} errors={e.phone} />
      <div className="space-y-1">
        <span className="block text-sm font-medium">{t("Time zone")}</span>
        <p className="rounded-md border border-neutral-400 px-3 py-2">{t("Europe/London (UK time)")}</p>
      </div>
      <Field label="Logo (optional)" name="logo" type="file" accept="image/png,image/jpeg,image/webp"
        hint="PNG, JPEG or WebP, up to 2 MB." errors={e.logo} />

      <fieldset className="space-y-4 rounded-md border border-neutral-300 p-4 dark:border-neutral-700">
        <legend className="px-1 text-base font-semibold">{t("Your plan")}</legend>
        <Field label="How many people will take bookings?" name="seats" inputMode="numeric" required
          value={seatsText} onChange={(ev) => setSeatsText(ev.target.value)}
          hint={t("Include yourself if you take bookings. {base} a month for one person, then {extra} a month for each extra person. You can change this later.", { base: formatPence(PRICING.baseMonthlyPence), extra: formatPence(PRICING.extraSeatMonthlyPence) })}
          errors={e.seats} />

        <fieldset>
          <legend className="mb-2 text-sm font-medium">{t("Billing")}</legend>
          <div className="space-y-2">
            {(["month", "year"] as const).map((i) => {
              const price = seatsOk ? pricePence(seats, i, packs) : null;
              return (
                <label key={i} className="flex items-start gap-3 rounded-md border border-neutral-300 p-3 dark:border-neutral-700">
                  <input type="radio" name="interval" value={i} checked={interval === i}
                    onChange={() => setInterval(i)} className="mt-1 h-5 w-5" />
                  <span>
                    <span className="block font-medium">{t(i === "month" ? "Monthly" : "Yearly (12 months for the price of 10)")}</span>
                    <span className="block text-sm">
                      {price === null ? t("Enter the number of people to see the price")
                        : t("{price} + VAT per {interval}", { price: formatPence(price), interval: t(i) })}
                      {price !== null && i === "year" && ` (${t("save {amount}", { amount: formatPence(yearlySavingPence(seats)) })})`}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          {e.interval && <p className="mt-1 text-sm text-red-700 dark:text-red-400">{t(e.interval[0])}</p>}
        </fieldset>

        {smsEnabled && (
        <div className="space-y-2">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="smsOn" checked={smsOn} onChange={(ev) => setSmsOn(ev.target.checked)} className="mt-1 h-5 w-5" />
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

        <div role="status" aria-live="polite" className="rounded-md bg-neutral-100 p-3 text-sm dark:bg-neutral-800">
          <p className="font-medium">{noTrial ? t("No free trial. You subscribe after setting up, and your booking page opens once you have.") : t("Free for {days} days. No card needed.", { days: PRICING.trialDays })}</p>
          {seatsOk && (() => {
            const net = pricePence(seats, interval, packs);
            return <p>{t(noTrial ? "Your plan" : "After the trial")}: {t("{net} + {vat} VAT = {gross} per {interval}.", { net: formatPence(net), vat: formatPence(vatPence(net)), gross: formatPence(grossPence(net)), interval: t(interval) })}</p>;
          })()}
        </div>
      </fieldset>

      <SubmitButton pending={pending}>{t(noTrial ? "Set up my business" : "Start my free trial")}</SubmitButton>
    </form>
  );
}
