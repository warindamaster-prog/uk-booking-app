"use client";

import { useActionState, useState } from "react";
import { saveColor } from "./actions";
import { FormError, SubmitButton } from "@/components/ui";
import type { FormState } from "@/lib/form";
import { paletteFor, THEMES, type ThemeName } from "@/lib/theme";
import { useT } from "@/lib/i18n/client";

/** Choose the shop's colour: ready-made palettes, with a small preview of buttons and a selected menu item. */
export function ColorForm({ current }: { current: ThemeName }) {
  const t = useT();
  const [state, action, pending] = useActionState<FormState, FormData>(saveColor, {});
  const [chosen, setChosen] = useState<ThemeName>(current);
  const p = paletteFor(chosen);
  // The default green is not a variable palette: show the real default values in the preview.
  const preview = chosen === "green" ? { brand: "#34553e", soft: "#e9efdc", text: "#3c6132", border: "#789467" } : { brand: p.brand, soft: p.soft, text: p.text, border: p.border };

  return (
    <form action={action} className="space-y-4">
      <FormError message={state.error} />
      {state.message && <p role="status" className="rounded-lg border border-green-700 p-3 text-sm text-green-800">{t(state.message)}</p>}
      {/* What is saved comes from the state, not from the radio buttons: React resets a form after its action, which would put the radios back to their first value. */}
      <input type="hidden" name="color" value={chosen} />
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t("Your colour")}</legend>
        <div className="flex flex-wrap gap-3">
          {THEMES.map((th) => {
            const c = th.name === "green" ? "#34553e" : paletteFor(th.name).brand;
            return (
              <label key={th.name} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm transition ${chosen === th.name ? "border-[#34553e] bg-[#eef3e9] font-medium" : "border-stone-200 bg-white hover:bg-stone-50"}`}>
                <input type="radio" name="swatch" value={th.name} checked={chosen === th.name} onChange={() => setChosen(th.name)} className="sr-only" />
                <span aria-hidden="true" className="h-5 w-5 rounded-full border border-black/10" style={{ background: c }} />
                {t(th.label)}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div aria-label={t("Preview")} className="rounded-xl border border-stone-200 bg-white p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-[1.4px] text-stone-500">{t("Preview")}</p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-white" style={{ background: preview.brand }}>{t("Book now")}</span>
          <span className="inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold" style={{ background: preview.soft, color: preview.text }}>{t("Selected")}</span>
          <span className="inline-flex min-h-11 items-center rounded-lg border bg-white px-4 text-sm" style={{ borderColor: preview.border, color: preview.text }}>{t("Choose")} →</span>
        </div>
      </div>

      <p className="text-sm text-[#6b756d]">{t("The colour is used in your dashboard and on your customers' booking pages.")}</p>
      <SubmitButton pending={pending}>Save colour</SubmitButton>
    </form>
  );
}
