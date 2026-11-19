"use client";

import Link from "next/link";
import { useActionState } from "react";
import { cancelBooking, markNoShow, refundDeposit, undoNoShow } from "./actions";
import { FormError } from "@/components/ui";
import type { FormState } from "@/lib/form";

type Can = { cancel: boolean; reschedule: boolean; markNoShow: boolean; undoNoShow: boolean };
const btn = "inline-flex min-h-11 items-center rounded-md border border-neutral-400 px-4 py-2 text-sm";

function Result({ state }: { state: FormState }) {
  return (
    <>
      <FormError message={state.error} />
      {state.message && <p role="status" className="rounded-md border border-green-700 p-3 text-sm text-green-800 dark:text-green-400">{state.message}</p>}
    </>
  );
}

export function BookingActions({ id, can, depositPaid, canRefund = false }: { id: string; can: Can; depositPaid: boolean; canRefund?: boolean }) {
  const [cancelState, cancelAction, cancelling] = useActionState<FormState, FormData>(cancelBooking, {});
  const [noShowState, noShowAction, markingNoShow] = useActionState<FormState, FormData>(markNoShow, {});
  const [undoState, undoAction, undoing] = useActionState<FormState, FormData>(undoNoShow, {});

  const [refundState, refundAction, refunding] = useActionState<FormState, FormData>(refundDeposit, {});
  if (!Object.values(can).some(Boolean) && !canRefund) return null;
  return (
    <section aria-labelledby="actions-h" className="space-y-3">
      <h2 id="actions-h" className="text-xl font-semibold">Actions</h2>
      <Result state={cancelState} /><Result state={noShowState} /><Result state={undoState} /><Result state={refundState} />
      <div className="flex flex-wrap gap-2">
        {can.reschedule && <Link href={`/dashboard/bookings/${id}/reschedule`} className={btn}>Reschedule</Link>}
        {can.markNoShow && (
          <form action={noShowAction}><input type="hidden" name="id" value={id} />
            <button type="submit" disabled={markingNoShow} className={btn}>Mark as no-show</button></form>
        )}
        {can.undoNoShow && (
          <form action={undoAction}><input type="hidden" name="id" value={id} />
            <button type="submit" disabled={undoing} className={btn}>Undo no-show</button></form>
        )}
      </div>
      {canRefund && !refundState.message && (
        <details className="rounded-md border border-neutral-300 p-3 dark:border-neutral-700">
          <summary className="cursor-pointer text-sm font-medium">Refund deposit</summary>
          <form action={refundAction} className="mt-3 space-y-3">
            <input type="hidden" name="id" value={id} />
            <p className="text-sm">Sends the deposit back to the customer&apos;s card (for example, a duplicate booking). The booking itself stays as it is. This can&apos;t be undone.</p>
            <button type="submit" disabled={refunding} className={btn}>{refunding ? "Refunding…" : "Yes, refund the deposit"}</button>
          </form>
        </details>
      )}
      {can.cancel && (
        <details className="rounded-md border border-neutral-300 p-3 dark:border-neutral-700">
          <summary className="cursor-pointer text-sm font-medium">Cancel this booking</summary>
          <form action={cancelAction} className="mt-3 space-y-3">
            <input type="hidden" name="id" value={id} />
            <p className="text-sm">The time becomes free for other customers. This can&apos;t be undone.</p>
            {depositPaid && (
              <fieldset className="space-y-2 text-sm">
                <legend className="font-medium">The customer has paid a deposit</legend>
                <label className="flex items-center gap-2"><input type="radio" name="depositChoice" value="refund" defaultChecked /> Refund the deposit to the customer</label>
                <label className="flex items-center gap-2"><input type="radio" name="depositChoice" value="keep" /> Keep the deposit</label>
              </fieldset>
            )}
            <button type="submit" disabled={cancelling}
              className="inline-flex min-h-11 items-center rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              Yes, cancel the booking
            </button>
          </form>
        </details>
      )}
    </section>
  );
}
