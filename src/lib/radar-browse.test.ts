import { describe, test, expect, beforeEach } from "vitest";
import { createClient, type Client } from "@libsql/client";
import {
  PAGE_SIZE,
  isBrowsable,
  listTables,
  loadRow,
  loadTable,
} from "./radar-browse";

let db: Client;

beforeEach(async () => {
  db = createClient({ url: ":memory:" });
  await db.batch(
    [
      "CREATE TABLE contacts (id INTEGER PRIMARY KEY, name TEXT, city TEXT)",
      "CREATE TABLE contact_projects (contact_id INTEGER, project TEXT, score INTEGER, PRIMARY KEY (contact_id, project))",
      "CREATE TABLE lessons_notes (id INTEGER PRIMARY KEY, body TEXT)",
      "CREATE TABLE sys_config (key TEXT PRIMARY KEY, value TEXT)",
      "INSERT INTO sys_config VALUES ('secret', 'hunter2')",
      "INSERT INTO contacts (id, name, city) VALUES (1, 'Premiere Film', 'Roma'), (2, '100% Cinema', 'Milano'), (3, 'Kidam', 'Roma')",
      "INSERT INTO contact_projects VALUES (3, 'walkie-talkie', 84)",
      "INSERT INTO lessons_notes (body) VALUES ('x')",
    ],
    "write",
  );
});

describe("isBrowsable", () => {
  test("allows the list and lessons_*, rejects sys tables", () => {
    expect(isBrowsable("contacts")).toBe(true);
    expect(isBrowsable("lessons_notes")).toBe(true);
    expect(isBrowsable("sys_config")).toBe(false);
    expect(isBrowsable("contacts; DROP TABLE contacts")).toBe(false);
  });
});

describe("listTables", () => {
  test("lists only browsable tables with counts", async () => {
    const t = await listTables(db);
    expect(t.map((x) => x.name)).toEqual([
      "contact_projects",
      "contacts",
      "lessons_notes",
    ]);
    expect(t.find((x) => x.name === "contacts")?.rows).toBe(3);
  });
});

describe("loadTable", () => {
  test("refuses sys_config and unknown tables", async () => {
    expect((await loadTable(db, { table: "sys_config" })).ok).toBe(false);
    expect((await loadTable(db, { table: "credits" })).ok).toBe(false);
  });

  test("sorts, searches and treats % literally", async () => {
    const sorted = await loadTable(db, {
      table: "contacts",
      sort: "name",
      dir: "desc",
    });
    expect(sorted.ok && sorted.value.rows.map((r) => r.name)).toEqual([
      "Premiere Film",
      "Kidam",
      "100% Cinema",
    ]);
    const roma = await loadTable(db, { table: "contacts", q: "roma" });
    expect(roma.ok && roma.value.total).toBe(2);
    const pct = await loadTable(db, { table: "contacts", q: "%" });
    expect(pct.ok && pct.value.total).toBe(1);
  });

  test("rejects a sort column that is not in the table", async () => {
    const r = await loadTable(db, {
      table: "contacts",
      sort: "name; DROP TABLE contacts",
    });
    expect(r.ok).toBe(false);
    expect((await listTables(db)).length).toBe(3);
  });

  test("paginates and clamps the page", async () => {
    const stmts = [];
    for (let i = 10; i < 10 + PAGE_SIZE + 5; i++)
      stmts.push({
        sql: "INSERT INTO contacts (id, name) VALUES (?, ?)",
        args: [i, `c${i}`],
      });
    await db.batch(stmts, "write");
    const p2 = await loadTable(db, { table: "contacts", page: 2 });
    expect(p2.ok && p2.value.rows.length).toBe(8);
    const far = await loadTable(db, { table: "contacts", page: 99 });
    expect(far.ok && far.value.page).toBe(2);
  });

  test("truncates very long cells", async () => {
    await db.execute({
      sql: "INSERT INTO contacts (id, name) VALUES (500, ?)",
      args: ["a".repeat(1000)],
    });
    const r = await loadTable(db, { table: "contacts", q: "aaaa" });
    expect(r.ok && String(r.value.rows[0].name).length).toBe(301);
  });
});

describe("filter and contact names", () => {
  test("exact filter on a real column, combined with search", async () => {
    const r = await loadTable(db, {
      table: "contacts",
      fcol: "city",
      fval: "Roma",
    });
    expect(r.ok && r.value.total).toBe(2);
    const both = await loadTable(db, {
      table: "contacts",
      fcol: "city",
      fval: "Roma",
      q: "kidam",
    });
    expect(both.ok && both.value.total).toBe(1);
  });

  test("rejects a filter column that is not in the table", async () => {
    const r = await loadTable(db, {
      table: "contacts",
      fcol: "name; DROP TABLE contacts",
      fval: "x",
    });
    expect(r.ok).toBe(false);
  });

  test("adds the contact name to rows with contact_id", async () => {
    const r = await loadTable(db, { table: "contact_projects" });
    expect(r.ok && r.value.rows[0]._contact).toBe("Kidam");
    const row = await loadRow(db, "contact_projects", 1);
    expect(row.ok && row.value?.contactName).toBe("Kidam");
  });
});

describe("facet", () => {
  test("counts values of a real column, honouring the search but not the filter", async () => {
    const all = await loadTable(db, { table: "contacts", facet: "city" });
    expect(all.ok && all.value.facet?.values).toEqual([
      { value: "Roma", count: 2 },
      { value: "Milano", count: 1 },
    ]);
    const filtered = await loadTable(db, {
      table: "contacts",
      facet: "city",
      fcol: "city",
      fval: "Milano",
      q: "film",
    });
    expect(filtered.ok && filtered.value.facet?.values).toEqual([
      { value: "Roma", count: 1 },
    ]);
  });

  test("ignores a facet column that is not in the table", async () => {
    const r = await loadTable(db, { table: "contacts", facet: "x; DROP" });
    expect(r.ok && r.value.facet).toBeNull();
  });
});

describe("segment", () => {
  test("keeps rows whose column is in the set, or outside it with sneg", async () => {
    const inSet = await loadTable(db, {
      table: "contacts",
      scol: "city",
      svals: ["Milano", "Torino"],
    });
    expect(inSet.ok && inSet.value.rows.map((r) => r.name)).toEqual([
      "100% Cinema",
    ]);
    const outside = await loadTable(db, {
      table: "contacts",
      scol: "city",
      svals: ["Roma"],
      sneg: true,
    });
    expect(outside.ok && outside.value.total).toBe(1);
  });

  test("sneg also keeps rows where the column is NULL", async () => {
    await db.execute(
      "INSERT INTO contacts (id, name) VALUES (9, 'Senza città')",
    );
    const r = await loadTable(db, {
      table: "contacts",
      scol: "city",
      svals: ["Roma"],
      sneg: true,
    });
    expect(r.ok && r.value.total).toBe(2);
  });

  test("rejects a segment column that is not in the table", async () => {
    const r = await loadTable(db, {
      table: "contacts",
      scol: "x; DROP",
      svals: ["a"],
    });
    expect(r.ok).toBe(false);
  });
});

describe("loadRow", () => {
  test("returns full values and the contact link", async () => {
    const c = await loadRow(db, "contacts", 1);
    expect(c.ok && c.value?.contactId).toBe(1);
    const cp = await loadRow(db, "contact_projects", 1);
    expect(cp.ok && cp.value?.contactId).toBe(3);
  });

  test("null for a missing row, error for a forbidden table", async () => {
    const missing = await loadRow(db, "contacts", 999);
    expect(missing.ok && missing.value).toBeNull();
    expect((await loadRow(db, "sys_config", 1)).ok).toBe(false);
  });
});
