"use client";

import { useActionState } from "react";
import { rescheduleBooking } from "../../actions";
import { FormError } from "@/components/ui";
import type { FormState } from "@/lib/form";

export function RescheduleForm({ id, staff, startsAt, label }: { id: string; staff: string; startsAt: string; label: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(rescheduleBooking, {});
  return (
    <form action={action} className="space-y-3">
      <FormError message={state.error} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="staff" value={staff} />
      <input type="hidden" name="startsAt" value={startsAt} />
      <button type="submit" disabled={pending}
        className="w-full rounded-md bg-neutral-900 px-4 py-3 text-base font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900">
        {pending ? "Please wait…" : `Move booking to ${label}`}
      </button>
    </form>
  );
}
