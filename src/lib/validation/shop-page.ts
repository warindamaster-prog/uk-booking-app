import { z } from "zod";

export const PHOTO_MAX_BYTES = 4 * 1024 * 1024;
export const MAX_PHOTOS = 12;

const text = (max: number, msg: string) =>
  z.string().max(max, msg).default("").transform((s) => s.replace(/\r\n?/g, "\n").trim() || null);

export const shopPageSchema = z.object({
  about: text(1500, "Keep this under 1,500 characters"),
  address: z.string().max(300, "Keep the address under 300 characters").default("").transform((s) => s.replace(/\s*\n\s*/g, ", ").trim() || null),
  additionalInfo: text(1500, "Keep this under 1,500 characters"),
});

/** Google Maps links built from the address typed by the owner. No API key is needed. */
export const mapEmbedUrl = (address: string) => `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
export const mapLinkUrl = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
