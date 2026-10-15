/** Minimal RFC 4180 CSV with a CSV-injection guard (spreadsheets execute cells starting with = + - @). */
export type CsvValue = string | number | boolean | null | undefined;

export function csvCell(v: CsvValue): string {
  if (v == null) return "";
  // numbers are data, never formulas: no guard (a negative number stays a number)
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(csvCell).join(","));
  return lines.join("\r\n") + "\r\n";
}
