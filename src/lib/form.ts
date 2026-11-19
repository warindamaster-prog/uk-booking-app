import type { ZodError } from "zod";
import { z } from "zod";

export type FormState = {
  error?: string;
  message?: string; // success feedback
  /** The booking form found a likely repeat booking and needs the customer to confirm. */
  duplicate?: { message: string };
  fieldErrors?: Record<string, string[] | undefined>;
  values?: Record<string, string>;
};

export function zodState(err: ZodError, values: Record<string, string>): FormState {
  return { fieldErrors: z.flattenError(err).fieldErrors as FormState["fieldErrors"], values };
}
