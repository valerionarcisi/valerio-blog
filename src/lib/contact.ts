import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Client } from "@libsql/client";
import { type Result, ok, err, isNonEmptyString, isValidEmail } from "~/lib/result";
import { isSpam } from "~/lib/spam-filter";

/**
 * Contact form back end. No CAPTCHA, no cookies, no third party: the protection is
 *   1. a honeypot field,
 *   2. a small proof of work solved by the visitor's browser (a signed, expiring, single-use challenge),
 *   3. rate limits on a hashed IP and a global daily cap (src/lib/rate-limit.ts),
 *   4. strict validation, the existing spam filter, and a same-site origin check in the route.
 * The message is only e-mailed; nothing about it is stored.
 */

export const TOPICS = ["film", "collab", "altro"] as const;
export type Topic = (typeof TOPICS)[number];
export type ContactLang = "it" | "en";

export const POW_BITS = 13;
export const CHALLENGE_TTL_SEC = 15 * 60;
export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 5000;

export interface ContactInput {
  name: string;
  email: string;
  message: string;
  topic: Topic | null;
  lang: ContactLang;
}

/* eslint-disable-next-line no-control-regex */
const CONTROL = /[\u0000-\u001f\u007f\u2028\u2029]/;

export type SpamVerdict = "spam";

export function parseContactInput(
  body: unknown,
): Result<ContactInput | "honeypot" | SpamVerdict> {
  if (!body || typeof body !== "object") return err("Invalid body");
  const b = body as Record<string, unknown>;

  // Bots fill every field: pretend success so they do not retry or adapt.
  if (typeof b.website === "string" && b.website.trim() !== "") return ok("honeypot" as const);

  // Line breaks and other control characters in a name are never legitimate: refuse them instead of
  // quietly turning them into spaces (the name ends up in an e-mail subject).
  if (!isNonEmptyString(b.name) || CONTROL.test(b.name)) return err("Invalid name");
  const name = b.name.trim().replace(/\s+/g, " ");
  if (!name || name.length > 100) return err("Invalid name");

  if (!isValidEmail(b.email) || (b.email as string).length > 254 || CONTROL.test(b.email as string))
    return err("Invalid email");
  const email = (b.email as string).trim();

  if (typeof b.message !== "string") return err("Invalid message");
  const message = b.message.replace(/\r\n/g, "\n").trim();
  if (message.length < MESSAGE_MIN) return err("Message too short");
  if (message.length > MESSAGE_MAX) return err("Message too long");

  let topic: Topic | null = null;
  if (b.topic !== undefined && b.topic !== null && b.topic !== "") {
    if (typeof b.topic !== "string" || !(TOPICS as readonly string[]).includes(b.topic))
      return err("Invalid topic");
    topic = b.topic as Topic;
  }
  const lang: ContactLang = b.lang === "en" ? "en" : "it";

  if (isSpam(message, name)) return ok("spam" as const);
  return ok({ name, email, message, topic, lang });
}

/** A value that is safe inside an e-mail header/subject: no line breaks, bounded length. */
export function headerSafe(value: string, max = 80): string {
  return value.replace(/[\r\n\u2028\u2029]+/g, " ").replace(CONTROL, "").trim().slice(0, max);
}

/* ---------- proof of work ---------- */

function key(secret: string): Buffer {
  return createHash("sha256").update(`contact-challenge:${secret}`).digest();
}
const sign = (secret: string, payload: string) =>
  createHmac("sha256", key(secret)).update(payload).digest("base64url").slice(0, 22);

export function makeChallenge(secret: string, nowMs: number = Date.now()): string {
  if (!secret) throw new Error("secret required");
  const id = randomBytes(12).toString("base64url");
  const exp = Math.floor(nowMs / 1000) + CHALLENGE_TTL_SEC;
  const payload = `${id}.${exp}`;
  return `${payload}.${sign(secret, payload)}`;
}

export function leadingZeroBits(buf: Uint8Array): number {
  let bits = 0;
  for (const byte of buf) {
    if (byte === 0) {
      bits += 8;
      continue;
    }
    bits += Math.clz32(byte) - 24;
    break;
  }
  return bits;
}

const NONCE = /^[A-Za-z0-9]{1,24}$/;

export function verifyChallenge(
  secret: string,
  challenge: unknown,
  nonce: unknown,
  nowMs: number = Date.now(),
): Result<{ id: string }> {
  if (!secret) return err("Not configured");
  if (typeof challenge !== "string" || typeof nonce !== "string") return err("Invalid challenge");
  const parts = challenge.split(".");
  if (parts.length !== 3 || !NONCE.test(nonce)) return err("Invalid challenge");
  const [id, exp, sig] = parts;
  const expected = sign(secret, `${id}.${exp}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return err("Invalid challenge");
  if (!/^\d+$/.test(exp) || Number(exp) * 1000 < nowMs) return err("Challenge expired");
  const hash = createHash("sha256").update(`${challenge}:${nonce}`).digest();
  if (leadingZeroBits(hash) < POW_BITS) return err("Invalid proof of work");
  return ok({ id });
}

/** Test/CLI helper; the browser has its own copy in src/scripts/contact-form.ts. */
export function solveChallenge(challenge: string, bits: number = POW_BITS): string {
  for (let i = 0; ; i++) {
    const nonce = i.toString(36);
    const hash = createHash("sha256").update(`${challenge}:${nonce}`).digest();
    if (leadingZeroBits(hash) >= bits) return nonce;
  }
}

/* ---------- single use ---------- */

let tableReady = new WeakSet<Client>();

/** A challenge can be used once. Fails OPEN (a database error never blocks a real person). */
export async function claimChallenge(
  db: Client,
  id: string,
  nowMs: number = Date.now(),
): Promise<boolean> {
  try {
    if (!tableReady.has(db)) {
      await db.execute(
        "CREATE TABLE IF NOT EXISTS contact_challenges (id TEXT PRIMARY KEY, used_at INTEGER NOT NULL)",
      );
      tableReady.add(db);
    }
    const res = await db.execute({
      sql: "INSERT OR IGNORE INTO contact_challenges (id, used_at) VALUES (?, ?)",
      args: [id, Math.floor(nowMs / 1000)],
    });
    if (Math.random() < 0.05) {
      // challenges expire after 15 minutes: nothing older than two hours can be replayed
      await db.execute({
        sql: "DELETE FROM contact_challenges WHERE used_at < ?",
        args: [Math.floor(nowMs / 1000) - 2 * 3600],
      });
    }
    return res.rowsAffected === 1;
  } catch {
    return true;
  }
}

/** Test helper: forget cached "table exists" state. */
export function resetContactCache(): void {
  tableReady = new WeakSet<Client>();
}
