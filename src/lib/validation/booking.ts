import { z } from "zod";
import { SLUG_RE } from "../slug";
import { CHOICE_RE } from "../booking/choices";

export const bookingInputSchema = z.object({
  slug: z.string().regex(SLUG_RE),
  serviceId: z.uuid(),
  staff: z.string().regex(CHOICE_RE),
  startsAt: z.iso.datetime({ message: "Choose a time" }),
  name: z.string().trim().min(1, "Enter your name").max(100, "Use 100 characters or fewer"),
  email: z.email("Enter a valid email address").max(254).transform((s) => s.trim().toLowerCase()),
  phone: z.string().trim().regex(/^[0-9+()\-\s]{7,20}$/, "Enter a valid phone number, for example 07700 900123"),
  marketingConsent: z.boolean(),
  website: z.string().max(0), // honeypot: real people leave it empty
});

export type BookingInput = z.infer<typeof bookingInputSchema>;

/** Query params for the booking page. Anything invalid falls back to a default. */
export const bookPageParams = z.object({
  staff: z.string().regex(CHOICE_RE).catch("any"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  time: z.iso.datetime().optional().catch(undefined),
});
