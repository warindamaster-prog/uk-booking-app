import { z } from "zod";
import { looksLikePublicHostname } from "../notifications/safe-host";

export const emailSettingsSchema = z.object({
  host: z.string().trim().toLowerCase().refine(looksLikePublicHostname, "Enter the outgoing mail server, for example smtp.gmail.com"),
  port: z.string().trim().regex(/^\d+$/).transform(Number).refine((n) => [465, 587, 2525].includes(n), "Use port 587 or 465"),
  user: z.string().trim().toLowerCase().pipe(z.email("Enter the full email address you send from").max(254)),
  pass: z.string().max(200, "That password is too long"),
  fromName: z.string().trim().max(100).transform((s) => s || null),
});
