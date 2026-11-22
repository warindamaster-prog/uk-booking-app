"use client";

import { useActionState, useState, type ReactNode } from "react";
import { saveShopPage } from "./actions";
import { FormError, SubmitButton } from "@/components/ui";
import type { FormState } from "@/lib/form";
import { useT } from "@/lib/i18n/client";
import { PAGE_SECTIONS } from "@/lib/validation/shop-page";
import { RANGES_PER_DAY, WEEKDAYS } from "@/lib/hours";
import { TimeSelect } from "@/components/time-select";

function Area({ id, label, hint, rows, max, defaultValue, error }: { id: string; label: string; hint?: string; rows: number; max: number; defaultValue: string; error?: string }) {
  const t = useT();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">{t(label)}</label>
      <textarea id={id} name={id} rows={rows} maxLength={max} defaultValue={defaultValue} className="block w-full rounded-md border border-neutral-400 bg-transparent px-3 py-2 text-base" />
      {hint && <p className="text-sm text-neutral-600 dark:text-neutral-400">{t(hint)}</p>}
      {error && <p className="text-sm text-red-700 dark:text-red-400">{t(error)}</p>}
    </div>
  );
}

/** One form for the whole Booking page tab: what to show first, then the photos (children), then the texts and opening times. */
export function ShopPageForm({ defaults, hoursEnabled, hoursOwn, hoursInitial, children }: {
  defaults: { about: string; address: string; additionalInfo: string; show: string[] };
  hoursEnabled: boolean; hoursOwn: boolean; hoursInitial: Record<string, string>;
  /** The photo manager. It sits inside the form but has no form elements of its own. */
  children: ReactNode;
}) {
  const t = useT();
  const [state, action, pending] = useActionState<FormState, FormData>(saveShopPage, {});
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};
  const [show, setShow] = useState<string[]>(defaults.show); // kept in state: the form resets itself after saving
  const [own, setOwn] = useState(hoursOwn);
  const ownNow = v.hoursMode ? v.hoursMode === "own" && own : own;
  const initial = { ...hoursInitial, ...Object.fromEntries(Object.entries(v).filter(([k]) => k.startsWith("h-"))) };
  return (
    <form action={action} className="space-y-8" noValidate>
      <FormError message={state.error} />
      {state.message && <p role="status" className="rounded-md border border-green-700 p-3 text-sm text-green-800 dark:text-green-400">{t(state.message)}</p>}

      <section aria-labelledby="show-h" className="space-y-2">
        <h2 id="show-h" className="text-xl font-semibold">{t("What to show")}</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">{t("Tick what customers see first. If you tick nothing, customers go straight to your service list.")}</p>
        <div className="grid gap-x-6 sm:grid-cols-2">
          {PAGE_SECTIONS.map((s) => (
            <label key={s.key} className="flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" name="show" value={s.key} className="h-5 w-5"
                checked={show.includes(s.key)} onChange={(ev) => setShow(ev.target.checked ? [...show, s.key] : show.filter((k) => k !== s.key))} />
              {t(s.label)}
            </label>
          ))}
        </div>
      </section>

      <section aria-labelledby="photos-h" className="space-y-3">
        <h2 id="photos-h" className="text-xl font-semibold">{t("Photos")}</h2>
        {children}
      </section>

      <section aria-labelledby="text-h" className="space-y-5">
        <h2 id="text-h" className="text-xl font-semibold">{t("About and address")}</h2>
        <Area id="about" label="About your shop" hint="A few lines for customers: who you are and what you do." rows={5} max={1500} defaultValue={v.about ?? defaults.about} error={e.about?.[0]} />
        <Area id="address" label="Address" hint="Shown with a map. Leave empty if you visit customers or don't want a map." rows={2} max={300} defaultValue={v.address ?? defaults.address} error={e.address?.[0]} />
        <Area id="additionalInfo" label="Additional information" hint="Parking, access, what to bring, payment methods, house rules…" rows={4} max={1500} defaultValue={v.additionalInfo ?? defaults.additionalInfo} error={e.additionalInfo?.[0]} />
      </section>

      <section aria-labelledby="hours-h" className="space-y-3">
        <h2 id="hours-h" className="text-xl font-semibold">{t("Opening times")}</h2>
        {hoursEnabled ? (
          <>
            <fieldset className="space-y-1">
              <legend className="sr-only">{t("Opening times")}</legend>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input type="radio" name="hoursMode" value="auto" checked={!ownNow} onChange={() => setOwn(false)} className="h-5 w-5" />
                {t("Use my team's working hours (Staff)")}
              </label>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input type="radio" name="hoursMode" value="own" checked={ownNow} onChange={() => setOwn(true)} className="h-5 w-5" />
                {t("Set my own opening times")}
              </label>
            </fieldset>
            {ownNow && (
              <div className="space-y-3">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">{t("Times are UK time, 24-hour clock. Leave a day blank if closed.")}</p>
                {WEEKDAYS.map((day, i) => {
                  const wd = i + 1;
                  const err = e[`day-${wd}`]?.[0];
                  return (
                    <fieldset key={day} className="rounded-md border border-neutral-300 p-3 dark:border-neutral-700">
                      <legend className="px-1 text-sm font-medium">{t(day)}</legend>
                      {Array.from({ length: initial[`h-${wd}-1-start`] ? RANGES_PER_DAY : 1 }, (_, n) => ( // one row a day; a second row only if one was saved earlier
                        <div key={n} className="mb-2 flex items-center gap-2 last:mb-0">
                          <TimeSelect id={`h-${wd}-${n}-start`} name={`h-${wd}-${n}-start`} label={t("{day} range {n} start", { day: t(day), n: n + 1 })} defaultValue={initial[`h-${wd}-${n}-start`] ?? ""} invalid={!!err} />
                          <span aria-hidden="true">{t("to")}</span>
                          <TimeSelect id={`h-${wd}-${n}-end`} name={`h-${wd}-${n}-end`} label={t("{day} range {n} end", { day: t(day), n: n + 1 })} defaultValue={initial[`h-${wd}-${n}-end`] ?? ""} />
                        </div>
                      ))}
                      {err && <p className="mt-1 text-sm text-red-700 dark:text-red-400">{t(err)}</p>}
                    </fieldset>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{t("Opening times are taken from your team's working hours (Staff).")}</p>
        )}
      </section>

      <SubmitButton pending={pending}>Save</SubmitButton>
    </form>
  );
}
