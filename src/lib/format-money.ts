/**
 * Compact money formatter for box office figures.
 * Returns null for missing/invalid values so callers can decide what to render.
 *
 *   1_500_000   -> "$1.5M"
 *   250_000_000 -> "$250M"
 *   850         -> "$850"
 *   0 | null    -> null
 */
export function formatMoneyCompact(value: unknown): string | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;

  if (n >= 1_000_000_000) {
    return `$${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  }
  if (n >= 1_000_000) {
    return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) {
    return `$${(n / 1_000).toFixed(0)}K`;
  }
  return `$${n}`;
}
