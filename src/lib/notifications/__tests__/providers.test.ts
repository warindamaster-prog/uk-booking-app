import type { Transporter } from "nodemailer";
import { describe, expect, it } from "vitest";
import { chooseProvider, RedirectingEmailProvider } from "../choose";
import type { EmailMessage } from "../provider";
import { SmtpEmailProvider } from "../smtp";

const msg: EmailMessage = {
  from: '"Lily Nails" <me@example.com>', to: "pat@customer.com", replyTo: "lily@example.com", subject: "Booking confirmed",
  text: "hi", html: "<p>hi</p>", attachments: [{ filename: "booking.ics", content: "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n", contentType: "text/calendar; method=PUBLISH" }],
  idempotencyKey: "k",
};

describe("chooseProvider", () => {
  it("auto-detects from the environment", () => {
    expect(chooseProvider({ SMTP_HOST: "smtp.gmail.com" })).toBe("smtp");
    expect(chooseProvider({ RESEND_API_KEY: "re_x" })).toBe("resend");
    expect(chooseProvider({ SMTP_HOST: "h", RESEND_API_KEY: "k" })).toBe("smtp");
    expect(chooseProvider({ NODE_ENV: "development" })).toBe("console");
    expect(chooseProvider({ NODE_ENV: "production" })).toBe("none");
  });
  it("EMAIL_PROVIDER forces a choice, and needs its settings", () => {
    expect(chooseProvider({ EMAIL_PROVIDER: "resend", SMTP_HOST: "h", RESEND_API_KEY: "k" })).toBe("resend");
    expect(chooseProvider({ EMAIL_PROVIDER: "smtp", RESEND_API_KEY: "k" })).toBe("none");
  });
});

describe("RedirectingEmailProvider", () => {
  it("sends everything to the test address and says who it was meant for", async () => {
    const seen: EmailMessage[] = [];
    const p = new RedirectingEmailProvider({ channel: "email", send: async (m) => { seen.push(m); return { id: "1" }; } }, "me@test.com");
    await p.send(msg);
    expect(seen[0].to).toBe("me@test.com");
    expect(seen[0].subject).toBe("[to pat@customer.com] Booking confirmed");
    expect(seen[0].replyTo).toBe("lily@example.com");
  });
  it("keeps the subject on one line", async () => {
    let subject = "";
    const p = new RedirectingEmailProvider({ channel: "email", send: async (m) => { subject = m.subject; return { id: "1" }; } }, "me@test.com");
    await p.send({ ...msg, to: "a@b.c\r\nBcc: x@y.z" });
    expect(subject).not.toMatch(/[\r\n]/);
  });
});

describe("SmtpEmailProvider (fake transport, no network)", () => {
  it("passes the message, calendar attachment and reply-to to the mail server and returns the message id", async () => {
    let captured: Record<string, unknown> = {};
    const transport = { sendMail: async (opts: Record<string, unknown>) => { captured = opts; return { messageId: "<abc@example.com>" }; } } as unknown as Transporter;
    const result = await new SmtpEmailProvider({ host: "unused", port: 587, user: "u", pass: "p" }, transport).send(msg);
    expect(result.id).toBe("<abc@example.com>");
    expect(captured).toMatchObject({ from: msg.from, to: msg.to, replyTo: msg.replyTo, subject: msg.subject, text: msg.text, html: msg.html });
    expect(captured.attachments).toEqual([{ filename: "booking.ics", content: msg.attachments![0].content, contentType: "text/calendar; method=PUBLISH" }]);
  });
  it("lets errors through so the outbox records the failure", async () => {
    const transport = { sendMail: async () => { throw new Error("535 Authentication failed"); } } as unknown as Transporter;
    await expect(new SmtpEmailProvider({ host: "h", port: 587, user: "u", pass: "p" }, transport).send(msg)).rejects.toThrow(/Authentication failed/);
  });
});

import { senderSettings } from "../choose";
import { createMailers } from "../resend";

describe("senderSettings and createMailers: who sends what", () => {
  const SMTP = { SMTP_HOST: "mail.example.com", SMTP_USER: "customers@example.com", SMTP_PASS: "x", EMAIL_FROM: "customers@example.com" };
  const NOTIFY = { NOTIFY_SMTP_HOST: "mail.example.com", NOTIFY_SMTP_USER: "alerts@example.com", NOTIFY_SMTP_PASS: "y", NOTIFY_EMAIL_FROM: "alerts@example.com", NOTIFY_FROM_NAME: "Booking alerts" };
  const mailers = (env: Record<string, string>) => createMailers(env as NodeJS.ProcessEnv);

  it("uses one mailbox for everything unless a separate alerts mailbox is configured", () => {
    const m = mailers(SMTP);
    expect(m.provider("customer")).toBe(m.provider("business"));
    expect(m.fromAddress("business")).toBe("customers@example.com");
    expect(senderSettings(SMTP).separateBusinessMailbox).toBe(false);
  });
  it("sends alerts to the business from their own mailbox, and customer emails from the main one", () => {
    const env = { ...SMTP, ...NOTIFY };
    const m = mailers(env);
    expect(m.provider("business")).not.toBe(m.provider("customer"));
    expect(m.fromAddress("business")).toBe("alerts@example.com");
    expect(m.fromAddress("customer")).toBe("customers@example.com");
    expect(m.fromName("business", "Lily Nails")).toBe("Booking alerts");
    expect(m.fromName("customer", "Lily Nails")).toBe("Lily Nails"); // customers see the shop's name
    expect(m.provider("business")).toBe(m.provider("business")); // built once
  });
  it("the alerts sender defaults to the alerts login, and its name has a default", () => {
    const s = senderSettings({ ...SMTP, NOTIFY_SMTP_HOST: "h", NOTIFY_SMTP_USER: "alerts@example.com" });
    expect(s.businessFrom).toBe("alerts@example.com");
    expect(s.businessName).toBe("Booking alerts");
  });
  it("EMAIL_OVERRIDE_TO redirects both audiences", async () => {
    const env = { ...SMTP, ...NOTIFY, EMAIL_OVERRIDE_TO: "me@test.com" };
    const m = mailers(env);
    for (const who of ["customer", "business"] as const) expect(m.provider(who)).toBeInstanceOf(RedirectingEmailProvider);
  });
  it("fails clearly when nothing is configured in production", () => {
    expect(() => mailers({ NODE_ENV: "production" }).provider("customer")).toThrow(/No email provider/);
  });
});
