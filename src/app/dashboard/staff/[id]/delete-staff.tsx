"use client";

import { useActionState, useRef } from "react";
import { deleteStaff } from "../actions";
import { FormError } from "@/components/ui";
import type { FormState } from "@/lib/form";
import { useT } from "@/lib/i18n/client";

export function DeleteStaff({ staffId, name }: { staffId: string; name: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<FormState, FormData>(deleteStaff, {});
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {t("They will no longer appear anywhere and cannot take bookings. Past bookings stay in your records. Their seat becomes free.")}
      </p>
      <FormError message={state.error} />
      <button type="button" onClick={() => dialog.current?.showModal()}
        className="rounded-md border border-red-700 px-4 py-2 text-sm font-medium text-red-800 dark:text-red-400">
        {t("Remove {name}", { name })}
      </button>
      <dialog ref={dialog} aria-labelledby="rm-h" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-neutral-400 bg-white p-5 text-neutral-900 backdrop:bg-black/50 dark:bg-neutral-900 dark:text-neutral-100">
        <form action={action} className="space-y-4">
          <input type="hidden" name="staffId" value={staffId} />
          <h3 id="rm-h" className="text-lg font-semibold">{t("Remove {name}?", { name })}</h3>
          <p className="text-sm">{t("This cannot be undone. You can only remove someone who has no upcoming bookings.")}</p>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => dialog.current?.close()} className="rounded-md border border-neutral-400 px-4 py-2 text-sm">{t("Keep")}</button>
            <button type="submit" disabled={pending} className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              {pending ? t("Removing…") : t("Yes, remove")}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
