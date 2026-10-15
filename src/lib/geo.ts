const COUNTRY_RE = /^[A-Za-z]{2}$/;

function pickCountry(obj: unknown): string | null {
  if (!obj || typeof obj !== "object") return null;
  const country = (obj as Record<string, unknown>).country;
  let code: unknown;
  if (typeof country === "string") code = country;
  else if (country && typeof country === "object") {
    code = (country as Record<string, unknown>).code;
  }
  if (typeof code !== "string" || !COUNTRY_RE.test(code)) return null;
  const upper = code.toUpperCase();
  return upper === "XX" || upper === "ZZ" ? null : upper;
}

function tryJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Tolerant parser for the Netlify `x-nf-geo` header: base64 (or base64url)
 * JSON like `{"country":{"code":"IT"}}`. Also accepts raw or URL-encoded JSON.
 * Only the country code is ever read; city and coordinates are ignored.
 */
export function parseNetlifyGeo(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const raw = value.trim();
  const candidates: string[] = [
    Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
      "utf8",
    ),
    raw,
  ];
  try {
    candidates.push(decodeURIComponent(raw));
  } catch {
    // not URI-encoded
  }
  for (const c of candidates) {
    const code = pickCountry(tryJson(c));
    if (code) return code;
  }
  return null;
}

/** Country from an edge-provided geo object (context.geo) or the x-nf-geo header. */
export function countryFromGeo(
  headers: Headers,
  contextGeo?: unknown,
): string | null {
  return pickCountry(contextGeo) ?? parseNetlifyGeo(headers.get("x-nf-geo"));
}
