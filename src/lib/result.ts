// ═══════════════════════════════════════════════════════════════
// Result pattern — rende esplicito successo/fallimento
// ═══════════════════════════════════════════════════════════════

export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E = string>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function andThen<T, U, E = string>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  return result.ok ? fn(result.value) : result;
}

// ═══════════════════════════════════════════════════════════════
// Pipe — composizione leggibile di trasformazioni
// ═══════════════════════════════════════════════════════════════

export function pipe<A, B>(a: A, ab: (a: A) => B): B;
export function pipe<A, B, C>(a: A, ab: (a: A) => B, bc: (b: B) => C): C;
export function pipe<A, B, C, D>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
): D;
export function pipe<A, B, C, D, E>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
): E;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pipe(value: unknown, ...fns: Array<(arg: any) => any>): unknown {
  return fns.reduce((acc, fn) => fn(acc), value);
}

// ═══════════════════════════════════════════════════════════════
// API helpers — risposta JSON uniforme
// ═══════════════════════════════════════════════════════════════

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

export function jsonOk(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

export function jsonErr(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: JSON_HEADERS,
  });
}

export function resultToResponse<T>(
  result: Result<T>,
  successStatus = 200,
): Response {
  return result.ok
    ? jsonOk(result.value, successStatus)
    : jsonErr(result.error, 400);
}

// ═══════════════════════════════════════════════════════════════
// Validazione — guardie di tipo riutilizzabili
// ═══════════════════════════════════════════════════════════════

export function isValidDate(d: unknown): d is string {
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
}

export function isNonEmptyString(val: unknown): val is string {
  return typeof val === "string" && val.trim().length > 0;
}

export function isValidEmail(val: unknown): val is string {
  return (
    typeof val === "string" &&
    val.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)
  );
}

export function clampInt(
  val: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (val === null || val === undefined) return fallback;
  const n = typeof val === "number" ? val : Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function parseJsonBody(request: Request): Promise<Result<unknown>> {
  return request
    .json()
    .then((body: unknown) => ok(body))
    .catch(() => err("Invalid JSON"));
}
