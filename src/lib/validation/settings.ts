import { z } from "zod";
import { PHONE_RE } from "./business";

export const CANCELLATION_PRESETS = [0, 1, 2, 4, 12, 24, 48, 72, 168] as const;

export function cancellationLabel(hours: number): string {
  if (hours === 0) return "Any time before the appointment starts";
  if (hours === 168) return "Up to 7 days before";
  if (hours % 24 === 0) return `Up to ${hours / 24} day${hours === 24 ? "" : "s"} before`;
  return `Up to ${hours} hour${hours === 1 ? "" : "s"} before`;
}

export const settingsSchema = z.object({
  ownerName: z.string().trim().min(1, "Enter the owner's name").max(100),
  email: z.email("Enter a valid email address").max(254).transform((s) => s.trim().toLowerCase()),
  phone: z.string().trim().regex(PHONE_RE, "Enter a valid phone number, for example 07700 900123"),
  cancellationHours: z.string().trim().regex(/^\d+$/, "Choose a cancellation window").transform(Number)
    .refine((n) => n >= 0 && n <= 720, "Choose a cancellation window"),
  privacyUrl: z.union([z.literal(""), z.url("Enter a full web address starting with https://").max(500)
    .refine((u) => u.startsWith("https://"), "The address must start with https://")])
    .transform((s) => s || null),
});
