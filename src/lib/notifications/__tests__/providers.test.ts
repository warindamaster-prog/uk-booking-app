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
