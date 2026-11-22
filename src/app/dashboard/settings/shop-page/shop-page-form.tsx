"use client";

import { useActionState, useState } from "react";
import { saveShopPage } from "./actions";
import { FormError, SubmitButton } from "@/components/ui";
import type { FormState } from "@/lib/form";
import { useT } from "@/lib/i18n/client";
import { PAGE_SECTIONS } from "@/lib/validation/shop-page";

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

export function ShopPageForm({ defaults }: { defaults: { about: string; address: string; additionalInfo: string; show: string[] } }) {
  const t = useT();
  const [state, action] = useActionState<FormState, FormData>(saveShopPage, {});
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};
  const [show, setShow] = useState<string[]>(defaults.show); // kept in state: the form resets itself after saving
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormError message={state.error} />
      {state.message && <p role="status" className="rounded-md border border-green-700 p-3 text-sm text-green-800 dark:text-green-400">{t(state.message)}</p>}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t("Show on your booking page")}</legend>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">{t("Tick what customers see first. If you tick nothing, customers go straight to your service list.")}</p>
        {PAGE_SECTIONS.map((s) => (
          <label key={s.key} className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" name="show" value={s.key} checked={show.includes(s.key)} onChange={(ev) => setShow(ev.target.checked ? [...show, s.key] : show.filter((k) => k !== s.key))} className="h-5 w-5" />
            {t(s.label)}
          </label>
        ))}
      </fieldset>
      <Area id="about" label="About your shop" hint="A few lines for customers: who you are and what you do." rows={5} max={1500} defaultValue={v.about ?? defaults.about} error={e.about?.[0]} />
      <Area id="address" label="Address" hint="Shown with a map. Leave empty if you visit customers or don't want a map." rows={2} max={300} defaultValue={v.address ?? defaults.address} error={e.address?.[0]} />
      <Area id="additionalInfo" label="Additional information" hint="Parking, access, what to bring, payment methods, house rules…" rows={4} max={1500} defaultValue={v.additionalInfo ?? defaults.additionalInfo} error={e.additionalInfo?.[0]} />
      <p className="text-sm text-neutral-600 dark:text-neutral-400">{t("Opening times are taken from your team's working hours (Staff).")}</p>
      <SubmitButton>Save</SubmitButton>
    </form>
  );
}
