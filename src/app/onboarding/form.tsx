"use client";

import { useActionState, useState } from "react";
import { createBusiness } from "./actions";
import { Field, FormError, SubmitButton } from "@/components/ui";
import type { FormState } from "@/lib/form";
import { formatPence } from "@/lib/money";
import { grossPence, isValidSeats, PRICING, pricePence, vatPence, yearlySavingPence, type BillingInterval } from "@/lib/pricing";
import { slugify } from "@/lib/slug";

export function OnboardingForm({ siteHost }: { siteHost: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createBusiness, {});
  const v = state.values ?? {};
  const [slug, setSlug] = useState<string | null>(null); // null = follow the business name
  const [name, setName] = useState(v.name ?? "");
  const [seatsText, setSeatsText] = useState(v.seats ?? "1");
  const [interval, setInterval] = useState<BillingInterval>(v.interval === "year" ? "year" : "month");
  const shownSlug = slug ?? v.slug ?? slugify(name);

  const seats = /^\d+$/.test(seatsText) ? Number(seatsText) : NaN;
  const seatsOk = isValidSeats(seats);
  const e = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormError message={state.error} />

      <Field label="Business name" name="name" required maxLength={100} autoComplete="organization"
        defaultValue={v.name} errors={e.name} onChange={(ev) => setName(ev.target.value)} />
      <Field label="Web address" name="slug" required value={shownSlug}
        onChange={(ev) => setSlug(ev.target.value.toLowerCase())}
        hint={`Your booking page: ${siteHost}/b/${shownSlug || "your-name"}`}
        errors={e.slug} autoCapitalize="none" spellCheck={false} />
      <Field label="Owner's name" name="ownerName" required maxLength={100} autoComplete="name"
        hint="Shown to customers if you take bookings yourself." defaultValue={v.ownerName} errors={e.ownerName} />
      <Field label="Contact email" name="email" type="email" required autoComplete="email" inputMode="email"
        hint="Booking notifications are sent here." defaultValue={v.email} errors={e.email} />
      <Field label="Phone number" name="phone" type="tel" required autoComplete="tel" inputMode="tel"
        defaultValue={v.phone} errors={e.phone} />
      <div className="space-y-1">
        <span className="block text-sm font-medium">Time zone</span>
        <p className="rounded-md border border-neutral-400 px-3 py-2">Europe/London (UK time)</p>
      </div>
      <Field label="Logo (optional)" name="logo" type="file" accept="image/png,image/jpeg,image/webp"
        hint="PNG, JPEG or WebP, up to 2 MB." errors={e.logo} />

      <fieldset className="space-y-4 rounded-md border border-neutral-300 p-4 dark:border-neutral-700">
        <legend className="px-1 text-base font-semibold">Your plan</legend>
        <Field label="How many people will take bookings?" name="seats" inputMode="numeric" required
          value={seatsText} onChange={(ev) => setSeatsText(ev.target.value)}
          hint={`Include yourself if you take bookings. ${formatPence(PRICING.baseMonthlyPence)} a month for one person, then ${formatPence(PRICING.extraSeatMonthlyPence)} a month for each extra person. You can change this later.`}
          errors={e.seats} />

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Billing</legend>
          <div className="space-y-2">
            {(["month", "year"] as const).map((i) => {
              const price = seatsOk ? pricePence(seats, i) : null;
              return (
                <label key={i} className="flex items-start gap-3 rounded-md border border-neutral-300 p-3 dark:border-neutral-700">
                  <input type="radio" name="interval" value={i} checked={interval === i}
                    onChange={() => setInterval(i)} className="mt-1 h-5 w-5" />
                  <span>
                    <span className="block font-medium">{i === "month" ? "Monthly" : "Yearly (12 months for the price of 10)"}</span>
                    <span className="block text-sm">
                      {price === null ? "Enter the number of people to see the price"
                        : `${formatPence(price)} + VAT per ${i}`}
                      {price !== null && i === "year" && ` (save ${formatPence(yearlySavingPence(seats))})`}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          {e.interval && <p className="mt-1 text-sm text-red-700 dark:text-red-400">{e.interval[0]}</p>}
        </fieldset>

        <div role="status" aria-live="polite" className="rounded-md bg-neutral-100 p-3 text-sm dark:bg-neutral-800">
          <p className="font-medium">Free for {PRICING.trialDays} days. No card needed.</p>
          {seatsOk && (() => {
            const net = pricePence(seats, interval);
            return <p>After the trial: {formatPence(net)} + {formatPence(vatPence(net))} VAT = {formatPence(grossPence(net))} per {interval}.</p>;
          })()}
        </div>
      </fieldset>

      <SubmitButton pending={pending}>Start my free trial</SubmitButton>
    </form>
  );
}
