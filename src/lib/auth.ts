export function timeSafeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  return result === 0;
}

export function verifyBearerToken(request: Request, envToken: string): boolean {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  return timeSafeEqual(authHeader.slice(7), envToken);
}

// Read ADMIN_TOKEN preferring process.env at runtime (not inlined by Vite),
// falling back to import.meta.env for local dev (where process.env is not populated from .env)
export function verifyAdminToken(token: string): boolean {
  const adminToken = process.env.ADMIN_TOKEN ?? import.meta.env.ADMIN_TOKEN;
  if (!adminToken) return false;
  return timeSafeEqual(token, adminToken);
}

export function verifyAdminBearerToken(request: Request): boolean {
  const adminToken = process.env.ADMIN_TOKEN ?? import.meta.env.ADMIN_TOKEN;
  if (!adminToken) return false;
  return verifyBearerToken(request, adminToken);
}
