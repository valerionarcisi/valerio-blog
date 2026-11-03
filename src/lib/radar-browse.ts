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
  filter: { col: string; val: string } | null;
  facet: { col: string; values: { value: string; count: number }[] } | null;
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

// Conteggi per valore di una colonna, con la ricerca applicata ma non il filtro: servono ai segmenti.
async function loadFacet(
  db: Client,
  table: string,
  columns: string[],
  col: string | null | undefined,
  q: string,
  qArgs: InValue[],
): Promise<TablePage["facet"]> {
  if (!col || !columns.includes(col)) return null;
  const search = q
    ? " WHERE (" +
      columns
        .map((c) => `CAST(${quote(c)} AS TEXT) LIKE ? ESCAPE '\\'`)
        .join(" OR ") +
      ")"
    : "";
  const res = await db.execute({
    sql: `SELECT CAST(${quote(col)} AS TEXT) AS v, COUNT(*) AS n FROM ${quote(table)}${search} GROUP BY v ORDER BY n DESC LIMIT 30`,
    args: qArgs,
  });
  return {
    col,
    values: res.rows.map((r) => ({
      value: r.v === null ? "" : String(r.v),
      count: Number(r.n),
    })),
  };
}

async function contactNames(
  db: Client,
  ids: unknown[],
): Promise<Map<number, string>> {
  const unique = [
    ...new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0)),
  ];
  if (!unique.length) return new Map();
  const res = await db.execute({
    sql: `SELECT id, name FROM contacts WHERE id IN (${unique.map(() => "?").join(",")})`,
    args: unique,
  });
  return new Map(res.rows.map((r) => [Number(r.id), String(r.name ?? "")]));
}

export type TableQuery = {
  table: string;
  page?: number;
  sort?: string | null;
  dir?: string | null;
  q?: string | null;
  fcol?: string | null;
  fval?: string | null;
  facet?: string | null;
  // Un segmento: la colonna vale uno tra `vals` (o nessuno di essi con `neg`).
  scol?: string | null;
  svals?: string[];
  sneg?: boolean;
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

  const filter =
    query.fcol && query.fval !== null && query.fval !== undefined
      ? { col: query.fcol, val: String(query.fval).slice(0, 200) }
      : null;
  if (filter && !columns.includes(filter.col)) return err("Colonna non valida");

  const svals = (query.svals ?? []).slice(0, 30).map((v) => String(v));
  if (query.scol && svals.length && !columns.includes(query.scol))
    return err("Colonna non valida");

  const args: InValue[] = [];
  const clauses: string[] = [];
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
    clauses.push(
      "(" +
        columns
          .map((c) => `CAST(${quote(c)} AS TEXT) LIKE ? ESCAPE '\\'`)
          .join(" OR ") +
        ")",
    );
    for (let i = 0; i < columns.length; i++) args.push(like);
  }
  if (filter) {
    clauses.push(`CAST(${quote(filter.col)} AS TEXT) = ?`);
    args.push(filter.val);
  }
  if (query.scol && svals.length) {
    const marks = svals.map(() => "?").join(",");
    const col = `CAST(${quote(query.scol)} AS TEXT)`;
    clauses.push(
      query.sneg
        ? `(${quote(query.scol)} IS NULL OR ${col} NOT IN (${marks}))`
        : `${col} IN (${marks})`,
    );
    args.push(...svals);
  }
  const where = clauses.length ? " WHERE " + clauses.join(" AND ") : "";
  const facet = await loadFacet(
    db,
    query.table,
    columns,
    query.facet,
    q,
    args.slice(0, q ? columns.length : 0),
  );

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

  const names = columns.includes("contact_id")
    ? await contactNames(
        db,
        res.rows.map((r) => r.contact_id),
      )
    : new Map<number, string>();

  return ok({
    table: query.table,
    columns,
    rows: res.rows.map((r) => {
      const o: Row = { _rowid: r._rowid };
      for (const c of columns) o[c] = cell(r[c]);
      if (columns.includes("contact_id"))
        o._contact = names.get(Number(r.contact_id)) ?? null;
      return o;
    }),
    total,
    page,
    pages,
    sort,
    dir,
    q,
    filter,
    facet,
  });
}

export type RowDetail = {
  table: string;
  rowid: number;
  values: Row;
  contactId: number | null;
  contactName: string | null;
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
  const contactId = typeof link === "number" && link > 0 ? link : null;
  const contactName = contactId
    ? ((await contactNames(db, [contactId])).get(contactId) ?? null)
    : null;
  return ok({ table, rowid, values, contactId, contactName });
}
