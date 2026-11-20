import { escapeHtml } from "./notifications/templates";

/**
 * The password reset email. The link goes to a page with a button (src/app/reset-password/confirm), NOT
 * straight to the sign-in step: mail scanners (Outlook, Gmail and others) open every link in a message
 * as it arrives, and a one-time link used up by a scanner would be dead before the person clicks it.
 */
export function renderResetEmail(link: string): { subject: string; text: string; html: string } {
  const text = [
    "Someone (hopefully you) asked to reset the password for your booking account.",
    "",
    `Choose a new password: ${link}`,
    "",
    "The link works once and expires in an hour. If you didn't ask for this, you can ignore this email: your password stays as it is.",
  ].join("\n");
  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#171717;line-height:1.5;max-width:560px;margin:0 auto;padding:16px">
<h1 style="font-size:20px;margin:0 0 12px">Reset your password</h1>
<p>Someone (hopefully you) asked to reset the password for your booking account.</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#171717;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none">Choose a new password</a></p>
<p style="color:#525252;font-size:13px">The link works once and expires in an hour. If you didn't ask for this, you can ignore this email: your password stays as it is.</p>
</body></html>`;
  return { subject: "Reset your password", text, html };
}

function shell(heading: string, bodyHtml: string, small: string): string {
  return `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#171717;line-height:1.5;max-width:560px;margin:0 auto;padding:16px">
<h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(heading)}</h1>
${bodyHtml}
<p style="color:#525252;font-size:13px">${escapeHtml(small)}</p>
</body></html>`;
}

const button = (link: string, label: string) =>
  `<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#171717;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none">${escapeHtml(label)}</a></p>`;

/** The email that confirms a new account. Same scanner-proof design: the link opens a page with a button. */
export function renderConfirmEmail(link: string): { subject: string; text: string; html: string } {
  const small = "The link works once and expires in an hour. If you didn't create an account, you can ignore this email.";
  return {
    subject: "Confirm your email address",
    text: ["Thanks for signing up. Confirm your email address to finish setting up your business.", "", `Confirm my email: ${link}`, "", small].join("\n"),
    html: shell("Confirm your email address", `<p>Thanks for signing up. Confirm your email address to finish setting up your business.</p>${button(link, "Confirm my email")}`, small),
  };
}

/** Sent when someone signs up with an email that already has an account (so we never reveal that on screen). */
export function renderExistingAccountEmail(loginUrl: string, resetUrl: string): { subject: string; text: string; html: string } {
  const small = "If this wasn't you, you can ignore this email: nothing has changed.";
  return {
    subject: "You already have an account",
    text: ["Someone tried to sign up with this email address, but you already have an account.", "", `Log in: ${loginUrl}`, `Forgot your password? ${resetUrl}`, "", small].join("\n"),
    html: shell("You already have an account", `<p>Someone tried to sign up with this email address, but you already have an account.</p>${button(loginUrl, "Log in")}<p><a href="${escapeHtml(resetUrl)}">Forgot your password?</a></p>`, small),
  };
}

/** Supabase's hashed one-time token: letters, digits, dash and underscore only. */
export const TOKEN_HASH_RE = /^[A-Za-z0-9_-]{16,200}$/;
