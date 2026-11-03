// ═══════════════════════════════════════════════════════════════
// Radar contatti — navigazione in sola lettura del DB del motore.
// Tabelle da una lista chiusa, colonne lette da PRAGMA: nel SQL entrano solo nomi verificati.
// Spec: docs/radar-contatti-spec.md ("Dati")
// ═══════════════════════════════════════════════════════════════
import type { Client, InValue } from "@libsql/client";
import { type Result, ok, err } from "~/lib/result";

// sys_config, sys_files e scripts restano fuori: possono contenere chiavi o configurazione del motore.
const BROWSABLE = new Set([
  "contacts",
  "contact_projects",
  "people",
  "credits",
  "deadlines",
  "sources",
  "source_candidates",
  "search_queries",
  "search_runs",
  "radar_runs",
  "radar_events",
  "radar_sources",
]);
const BROWSABLE_PREFIX = "lessons_";

export const PAGE_SIZE = 50;
const CELL_MAX = 300;

type Row = Record<string, unknown>;

export type TableInfo = { name: string; rows: number };
export type TablePage = {
  table: string;
  columns: string[];
  rows: Row[];
  total: number;
  page: number;
  pages: number;
  sort: string | null;
  dir: "asc" | "desc";
  q: string;
};

export const isBrowsable = (name: string): boolean =>
  BROWSABLE.has(name) || name.startsWith(BROWSABLE_PREFIX);

const quote = (ident: string): string => `"${ident.replace(/"/g, '""')}"`;

function cell(v: unknown): unknown {
  if (typeof v === "string" && v.length > CELL_MAX)
    return v.slice(0, CELL_MAX) + "…";
  if (v instanceof ArrayBuffer) return `[binario ${v.byteLength} byte]`;
  return v;
}

async function columnsOf(db: Client, table: string): Promise<string[]> {
  const res = await db.execute(`PRAGMA table_info(${quote(table)})`);
  return res.rows.map((r) => String(r.name));
}

async function existingTables(db: Client): Promise<string[]> {
  const res = await db.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  return res.rows.map((r) => String(r.name)).filter(isBrowsable);
}

export async function listTables(db: Client): Promise<TableInfo[]> {
  const out: TableInfo[] = [];
  for (const name of await existingTables(db)) {
    const res = await db.execute(`SELECT COUNT(*) AS n FROM ${quote(name)}`);
    out.push({ name, rows: Number(res.rows[0]?.n ?? 0) });
  }
  return out;
}

export type TableQuery = {
  table: string;
  page?: number;
  sort?: string | null;
  dir?: string | null;
  q?: string | null;
};

export async function loadTable(
  db: Client,
  query: TableQuery,
): Promise<Result<TablePage, string>> {
  if (!isBrowsable(query.table)) return err("Tabella non consultabile");
  if (!(await existingTables(db)).includes(query.table))
    return err("Tabella non trovata");

  const columns = await columnsOf(db, query.table);
  const sort = query.sort && columns.includes(query.sort) ? query.sort : null;
  if (query.sort && !sort) return err("Colonna non valida");
  const dir = query.dir === "desc" ? "desc" : "asc";
  const q = (query.q ?? "").trim().slice(0, 100);

  const args: InValue[] = [];
  let where = "";
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
    where =
      " WHERE " +
      columns
        .map((c) => `CAST(${quote(c)} AS TEXT) LIKE ? ESCAPE '\\'`)
        .join(" OR ");
    for (let i = 0; i < columns.length; i++) args.push(like);
  }

  const totalRes = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM ${quote(query.table)}${where}`,
    args,
  });
  const total = Number(totalRes.rows[0]?.n ?? 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(query.page ?? 1) || 1), pages);

  const order = sort
    ? ` ORDER BY ${quote(sort)} ${dir}, rowid`
    : " ORDER BY rowid";
  const res = await db.execute({
    sql: `SELECT rowid AS _rowid, * FROM ${quote(query.table)}${where}${order} LIMIT ? OFFSET ?`,
    args: [...args, PAGE_SIZE, (page - 1) * PAGE_SIZE],
  });

  return ok({
    table: query.table,
    columns,
    rows: res.rows.map((r) => {
      const o: Row = { _rowid: r._rowid };
      for (const c of columns) o[c] = cell(r[c]);
      return o;
    }),
    total,
    page,
    pages,
    sort,
    dir,
    q,
  });
}

export type RowDetail = {
  table: string;
  rowid: number;
  values: Row;
  contactId: number | null;
};

export async function loadRow(
  db: Client,
  table: string,
  rowid: number,
): Promise<Result<RowDetail | null, string>> {
  if (!isBrowsable(table)) return err("Tabella non consultabile");
  if (!(await existingTables(db)).includes(table))
    return err("Tabella non trovata");
  if (!Number.isInteger(rowid) || rowid <= 0) return err("rowid non valido");

  const res = await db.execute({
    sql: `SELECT * FROM ${quote(table)} WHERE rowid = ?`,
    args: [rowid],
  });
  const raw = res.rows[0];
  if (!raw) return ok(null);

  const columns = await columnsOf(db, table);
  const values: Row = {};
  for (const c of columns) {
    const v = raw[c];
    values[c] = v instanceof ArrayBuffer ? `[binario ${v.byteLength} byte]` : v;
  }
  const link =
    table === "contacts"
      ? values.id
      : columns.includes("contact_id")
        ? values.contact_id
        : null;
  return ok({
    table,
    rowid,
    values,
    contactId: typeof link === "number" && link > 0 ? link : null,
  });
}
