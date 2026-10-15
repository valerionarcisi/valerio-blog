import { createHash, timingSafeEqual } from "node:crypto";

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

// Hashing both sides gives fixed-length buffers, so neither the length nor the
// content of the expected secret leaks through timing.
export function timeSafeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length === 0 || b.length === 0) return false;
  return timingSafeEqual(digest(a), digest(b));
}

export function verifyBearerToken(request: Request, envToken: string): boolean {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  return timeSafeEqual(authHeader.slice(7), envToken);
}
