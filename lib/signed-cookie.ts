import "server-only";
import crypto from "crypto";

function getSecret(): string {
  const s = process.env.SESSION_COOKIE_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "SESSION_COOKIE_SECRET must be set to a random string of at least 16 chars",
    );
  }
  return s;
}

export function sign<T>(data: T): string {
  const json = JSON.stringify(data);
  const b64 = Buffer.from(json).toString("base64url");
  const hmac = crypto
    .createHmac("sha256", getSecret())
    .update(b64)
    .digest("base64url");
  return `${b64}.${hmac}`;
}

export function verify<T>(value: string | undefined | null): T | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot < 1) return null;
  const b64 = value.slice(0, dot);
  const hmac = value.slice(dot + 1);
  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(b64)
    .digest("base64url");
  const a = Buffer.from(hmac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(b64, "base64url").toString()) as T;
  } catch {
    return null;
  }
}
