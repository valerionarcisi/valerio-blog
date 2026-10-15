import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "vb_admin";
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

function sign(secret: string, expiry: number): string {
  return createHmac("sha256", secret)
    .update(`admin-session:${expiry}`)
    .digest("base64url");
}

/** Cookie value: `<expiryUnixSeconds>.<base64url HMAC>`; the HMAC key is ADMIN_TOKEN. */
export function createSessionValue(secret: string, now: number = Date.now()): string {
  if (!secret) throw new Error("Cannot create a session without a secret");
  const expiry = Math.floor(now / 1000) + SESSION_TTL_SECONDS;
  return `${expiry}.${sign(secret, expiry)}`;
}

export function verifySessionValue(
  value: string | null | undefined,
  secret: string,
  now: number = Date.now(),
): boolean {
  if (!secret || !value || typeof value !== "string") return false;
  const m = /^(\d{1,12})\.([A-Za-z0-9_-]{43})$/.exec(value);
  if (!m) return false;
  const expiry = Number(m[1]);
  if (!Number.isSafeInteger(expiry) || expiry <= Math.floor(now / 1000)) return false;
  const given = Buffer.from(m[2]);
  const expected = Buffer.from(sign(secret, expiry));
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}

export function sessionCookieHeader(value: string, opts: { secure: boolean }): string {
  return (
    `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}` +
    (opts.secure ? "; Secure" : "")
  );
}

export function clearCookieHeader(opts: { secure?: boolean } = {}): string {
  return (
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0` +
    (opts.secure ? "; Secure" : "")
  );
}

export function readSessionCookie(request: Request): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    if (part.slice(0, i).trim() === SESSION_COOKIE) return part.slice(i + 1).trim();
  }
  return null;
}
