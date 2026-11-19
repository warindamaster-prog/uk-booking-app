import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Encrypts small secrets (a shop's mailbox password) with AES-256-GCM before they are stored.
 * The key is EMAIL_CREDENTIALS_KEY: 32 random bytes, base64url. Format: v1.<iv>.<tag>.<ciphertext>.
 */
export function parseKey(raw: string | undefined): Buffer {
  const key = raw ? Buffer.from(raw, "base64url") : Buffer.alloc(0);
  if (key.length !== 32) throw new Error("EMAIL_CREDENTIALS_KEY must be 32 random bytes, base64url encoded");
  return key;
}

export function encryptSecret(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

export function decryptSecret(box: string, key: Buffer): string {
  const [v, iv, tag, ct] = box.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("unrecognised secret format");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}
