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
