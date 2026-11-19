import { z } from "zod";
import { looksLikePublicHostname } from "../notifications/safe-host";

export const EMAIL_PRESETS = [
  { id: "gmail", label: "Gmail", host: "smtp.gmail.com", port: 587, help: "Turn on 2-step verification in your Google account, then create an \"app password\" and use that as the password." },
  { id: "outlook", label: "Outlook / Microsoft 365", host: "smtp.office365.com", port: 587, help: "Use your full email address. If sign-in fails, your administrator may need to allow SMTP for the mailbox." },
  { id: "other", label: "Other (your domain's mail provider)", host: "", port: 465, help: "Your email provider shows the outgoing (SMTP) server name and port in its help pages." },
] as const;

export const emailSettingsSchema = z.object({
  host: z.string().trim().toLowerCase().refine(looksLikePublicHostname, "Enter the outgoing mail server, for example smtp.gmail.com"),
  port: z.string().trim().regex(/^\d+$/).transform(Number).refine((n) => [465, 587, 2525].includes(n), "Use port 587 or 465"),
  user: z.string().trim().toLowerCase().pipe(z.email("Enter the full email address you send from").max(254)),
  pass: z.string().max(200, "That password is too long"),
  fromName: z.string().trim().max(100).transform((s) => s || null),
});
