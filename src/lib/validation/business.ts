import { z } from "zod";
import { PRICING } from "@/lib/pricing";
import { SLUG_RE } from "@/lib/slug";

export const RESERVED_SLUGS = new Set(["admin", "api", "app", "login", "signup", "dashboard", "www"]);

export const PHONE_RE = /^[0-9+()\-\s]{7,20}$/;

export const onboardingSchema = z.object({
  name: z.string().trim().min(1, "Enter your business name").max(100),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(SLUG_RE, "Use 3-40 letters, numbers or hyphens, starting with a letter or number")
    .refine((s) => !RESERVED_SLUGS.has(s), "That web address is reserved"),
  ownerName: z.string().trim().min(1, "Enter the owner's name").max(100),
  email: z.email("Enter a valid email address").max(254).transform((s) => s.trim().toLowerCase()),
  phone: z.string().trim().regex(PHONE_RE, "Enter a valid phone number, for example 07700 900123"),
  seats: z.string().trim().regex(/^\d+$/, "Enter a whole number")
    .transform(Number)
    .refine((n) => n >= PRICING.minSeats && n <= PRICING.maxSeats, `Enter a number from ${PRICING.minSeats} to ${PRICING.maxSeats}`),
  interval: z.enum(["month", "year"], { message: "Choose monthly or yearly" }),
  /** Optional SMS confirmation packs chosen at setup (0 = none). */
  smsPacks: z.string().trim().default("0").pipe(z.string().regex(/^\d+$/, "Enter a whole number")).transform(Number)
    .refine((n) => n >= 0 && n <= PRICING.maxSmsPacks, `Enter a number from 0 to ${PRICING.maxSmsPacks}`),
});

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as const;

/** Check the real file signature, not just the client-supplied MIME type. */
export function sniffLogoType(bytes: Uint8Array): keyof typeof LOGO_TYPES | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) return "image/webp";
  return null;
}
