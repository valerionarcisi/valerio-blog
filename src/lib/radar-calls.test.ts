import { describe, test, expect, beforeEach } from "vitest";
import { createClient, type Client } from "@libsql/client";
import {
  actionWindow,
  applyAction,
  applyFilters,
  buildTimeline,
  groupByMonth,
  groupContactsByBasis,
  loadArchive,
  loadOverview,
  loadProposal,
  loadRegion,
  parseAction,
  parseStringList,
  parseTargets,
  sessionIsOpen,
  toProposal,
  type RegionContact,
} from "./radar-calls";

const TODAY = "2026-11-09";

async function seed(): Promise<Client> {
  const db = createClient({ url: ":memory:" });
  await db.batch([
    `CREATE TABLE regional_calls (id INTEGER PRIMARY KEY, region TEXT, title TEXT, sheet_kind TEXT, status TEXT, works TEXT, phases TEXT,
       beneficiaries TEXT, budget_text TEXT, min_contribution TEXT, max_contribution TEXT, official_url TEXT, ifm_url TEXT, description TEXT, fits TEXT)`,
    `CREATE TABLE call_sessions (id INTEGER PRIMARY KEY, call_id INTEGER, opens TEXT, closes TEXT, status TEXT)`,
    `CREATE TABLE call_proposals (id INTEGER PRIMARY KEY, call_id INTEGER, project TEXT, predicted_opens TEXT, predicted_closes TEXT,
       confidence TEXT, basis TEXT, angle TEXT, pitch TEXT, prepare TEXT, warnings TEXT, targets_json TEXT, created_at TEXT, alerted_at TEXT, suitable INTEGER DEFAULT 1)`,
    `CREATE TABLE contacts (id INTEGER PRIMARY KEY, name TEXT, email TEXT, official_url TEXT)`,
    `CREATE TABLE contact_regions (id INTEGER PRIMARY KEY, contact_id INTEGER, region TEXT, basis TEXT, place TEXT)`,
    `CREATE TABLE credits (id INTEGER PRIMARY KEY, contact_id INTEGER, title TEXT, year INTEGER, funds TEXT)`,
    `CREATE TABLE contact_projects (contact_id INTEGER, project TEXT, score INTEGER, stage TEXT, shortlist INTEGER DEFAULT 0)`,
    `CREATE TABLE radar_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, payload TEXT, status TEXT DEFAULT 'pending', note TEXT,
       created_at TEXT DEFAULT (datetime('now')), done_at TEXT)`,
    `INSERT INTO regional_calls (id, region, title, sheet_kind, status, official_url) VALUES
       (1, 'lazio', 'Lazio Cinema', 'bando', NULL, 'https://lazio.example'),
       (2, 'sardegna', 'Sardegna Sviluppo', 'bando', 'chiuso', NULL),
       (3, 'lazio', 'Studio facilities', 'facilities', NULL, NULL)`,
    `INSERT INTO call_sessions (id, call_id, opens, closes, status) VALUES
       (1, 1, '2026-10-20', '2026-11-30', 'in chiusura'),
       (2, 1, '2025-10-20', '2025-11-30', 'chiuso'),
       (3, 2, NULL, '2026-03-01', 'chiuso')`,
    `INSERT INTO call_proposals (id, call_id, project, predicted_opens, predicted_closes, confidence, basis, targets_json, suitable) VALUES
       (1, 1, 'walkie-talkie', '2027-01-15', '2027-02-28', 'media', 'annuale', '[{"id":10,"name":"Wildside","email":"info@w.it","score":71,"why":"ha vinto"},{"id":11,"name":"Senza Mail","score":90}]', 1),
       (2, 2, 'non-fa-ridere', '2027-02-01', '2027-03-01', 'bassa', 'forse', '[]', 0),
       (3, 1, 'non-fa-ridere', '2026-05-01', '2026-06-01', 'alta', 'passata', '[]', 1),
       (4, 1, 'walkie-talkie', '2028-09-01', NULL, 'bassa', 'lontana', '[]', 1)`,
    `INSERT INTO contacts (id, name, email) VALUES (10, 'Wildside', 'info@w.it'), (11, 'Senza Mail', NULL), (12, 'Sede Srl', 'mario@s.it')`,
    `INSERT INTO contact_regions (contact_id, region, basis, place) VALUES
       (12, 'lazio', 'sede', 'Roma'), (10, 'lazio', 'fondo_regionale', 'Roma'), (11, 'lazio', 'film_commission', NULL)`,
    `INSERT INTO credits (contact_id, title, year, funds) VALUES
       (10, 'Film A', 2024, 'Fondo regionale Lazio: Bando 2024'),
       (10, 'Film B', 2022, 'Fondo regionale Lazio: Bando 2022'),
       (10, 'Film C', 2021, 'Fondo regionale Puglia: Altro'),
       (12, 'Film D', 2023, NULL)`,
    `INSERT INTO contact_projects (contact_id, project, score, stage) VALUES (10, 'walkie-talkie', 80, 'contacted')`,
  ]);
  return db;
}

describe("actionWindow", () => {
  test("bordi: 150 e 45 giorni prima dell'apertura", () => {
    const opens = "2027-01-15";
    expect(actionWindow(opens, "2026-08-18")?.state).toBe("now"); // -150
    expect(actionWindow(opens, "2026-08-17")?.state).toBe("future");
  });
  test("45 giorni esatti è ancora finestra, dopo è closing, all'apertura è passata", () => {
    const opens = "2027-01-15";
    expect(actionWindow(opens, "2026-12-01")?.state).toBe("now");
    expect(actionWindow(opens, "2026-12-02")?.state).toBe("closing");
    expect(actionWindow(opens, "2027-01-15")?.state).toBe("passed");
  });
  test("date mancanti", () => {
    expect(actionWindow(null, TODAY)).toBeNull();
    expect(actionWindow("boh", TODAY)).toBeNull();
  });
});

describe("JSON difensivo", () => {
  test("parseStringList", () => {
    expect(parseStringList('["a"," b ",3,null,""]')).toEqual(["a", "b"]);
    expect(parseStringList("{rotto")).toEqual([]);
    expect(parseStringList(null)).toEqual([]);
    expect(parseStringList('{"a":1}')).toEqual([]);
  });
  test("parseTargets scarta i malformati e ordina per score", () => {
    const t = parseTargets(
      JSON.stringify([
        { id: 1, name: "A", score: 10 },
        { id: 2, name: "B", score: 90, email: " x@y.it " },
        { id: "x", name: "C" },
        { id: 3 },
        "str",
        { id: 4, name: "D", score: "alto" },
      ]),
    );
    expect(t.map((x) => x.id)).toEqual([2, 1, 4]);
    expect(t[0].email).toBe("x@y.it");
    expect(t[2].score).toBeNull();
    expect(parseTargets("")).toEqual([]);
  });
});

describe("sessioni aperte", () => {
  test("date, non status", () => {
    expect(sessionIsOpen({ opens: "2026-10-20", closes: "2026-11-30" }, TODAY)).toBe(true);
    expect(sessionIsOpen({ opens: null, closes: "2026-11-09" }, TODAY)).toBe(true);
    expect(sessionIsOpen({ opens: "2026-12-01", closes: "2026-12-30" }, TODAY)).toBe(false);
    expect(sessionIsOpen({ opens: null, closes: null }, TODAY)).toBe(false);
    expect(sessionIsOpen({ opens: null, closes: "2026-03-01" }, TODAY)).toBe(false);
  });
});

describe("timeline", () => {
  test("solo adatte, non chiuse, entro 12 mesi", async () => {
    const db = await seed();
    const o = await loadOverview(db, TODAY);
    expect(o.timeline.map((p) => p.id)).toEqual([1]);
    expect(o.open.map((c) => [c.call_id, c.days_left])).toEqual([[1, 21]]);
    expect(o.timeline[0].position).toBeGreaterThan(0.1);
    expect(o.timeline[0].window_start).toBeLessThan(o.timeline[0].window_end);
    expect(o.timeline[0].month).toBe("2027-01");
  });
  test("apertura già passata ma ancora aperta resta a 0", () => {
    const p = toProposal(
      { id: 9, call_id: 1, project: "walkie-talkie", predicted_opens: "2026-10-01", predicted_closes: "2026-12-01", confidence: "annunciata", suitable: 1 },
      TODAY,
    );
    const [row] = buildTimeline([p], TODAY);
    expect(row.position).toBe(0);
    expect(row.month).toBe("2026-11");
  });
  test("groupByMonth e filtri", async () => {
    const db = await seed();
    const { timeline } = await loadOverview(db, TODAY);
    expect(groupByMonth(timeline).map((g) => g.month)).toEqual(["2027-01"]);
    expect(applyFilters(timeline, { project: "non-fa-ridere" })).toHaveLength(0);
    expect(applyFilters(timeline, { region: "lazio", confidence: "media" })).toHaveLength(1);
    expect(applyFilters(timeline, { windowOnly: true })).toHaveLength(1); // 67 giorni all'apertura: dentro la finestra
  });
});

describe("archivio", () => {
  test("non adatte, passate/lontane e bandi chiusi", async () => {
    const db = await seed();
    const a = await loadArchive(db, TODAY);
    expect(a.notSuitable.map((p) => p.id)).toEqual([2]);
    expect(a.past.map((p) => p.id).sort()).toEqual([3, 4]);
    expect(a.closedCalls.map((c) => c.id)).toEqual([2]);
  });
});

describe("scheda proposta", () => {
  test("target con pipeline e flag email, richieste", async () => {
    const db = await seed();
    const d = await loadProposal(db, 1, TODAY);
    expect(d?.targets.map((t) => t.id)).toEqual([11, 10]);
    const wild = d!.targets.find((t) => t.id === 10)!;
    expect(wild.stage).toBe("contacted");
    expect(wild.mail_kind).toBe("generic");
    expect(d!.targets.find((t) => t.id === 11)!.stage).toBeNull();
    expect(d!.sessions).toHaveLength(2);
    expect(await loadProposal(db, 99, TODAY)).toBeNull();
  });
});

describe("regione", () => {
  test("vincitori prima, con titoli solo del fondo della regione", async () => {
    const db = await seed();
    const r = await loadRegion(db, "lazio", TODAY);
    expect(r.groups.map((g) => g.basis)).toEqual(["fondo_regionale", "film_commission", "sede"]);
    const winner = r.groups[0].contacts[0];
    expect(winner.wins.map((w) => w.title)).toEqual(["Film A", "Film B"]);
    expect(r.calls.map((c) => c.id)).toContain(3);
    expect(r.proposals.map((p) => p.id)).toEqual([3, 1, 4]);
  });
  test("ordine basis sconosciuto in coda", () => {
    const mk = (basis: string): RegionContact => ({ id: 1, name: basis, email: null, mail_kind: "none", basis, place: null, wins: [] });
    expect(groupContactsByBasis([mk("altro"), mk("sede"), mk("fondo_regionale")]).map((g) => g.basis)).toEqual([
      "fondo_regionale",
      "sede",
      "altro",
    ]);
  });
});

describe("azioni", () => {
  let db: Client;
  beforeEach(async () => {
    db = await seed();
  });

  test("parseAction", () => {
    expect(parseAction({ action: "prepare_drafts", proposal_id: 1 }).ok).toBe(true);
    expect(parseAction({ action: "set_suitable", proposal_id: 1, value: "si" }).ok).toBe(false);
    expect(parseAction({ action: "prepare_drafts", proposal_id: 0 }).ok).toBe(false);
    expect(parseAction({ action: "drop", proposal_id: 1 }).ok).toBe(false);
    expect(parseAction(null).ok).toBe(false);
  });

  test("prepare_drafts accoda e non duplica", async () => {
    const a = await applyAction(db, { type: "prepare_drafts", proposal_id: 1 });
    expect(a.ok && a.value.request_id).toBeTruthy();
    const b = await applyAction(db, { type: "prepare_drafts", proposal_id: 1 });
    expect(b.ok && b.value.done).toBe("Richiesta già in corso");
    const rs = await db.execute("SELECT kind, payload, status FROM radar_requests");
    expect(rs.rows).toHaveLength(1);
    expect(rs.rows[0].payload).toBe("1 bozze");
  });

  test("prepare_drafts rifiuta non adatta, senza email, inesistente", async () => {
    expect((await applyAction(db, { type: "prepare_drafts", proposal_id: 2 })).ok).toBe(false);
    expect((await applyAction(db, { type: "prepare_drafts", proposal_id: 3 })).ok).toBe(false);
    expect((await applyAction(db, { type: "prepare_drafts", proposal_id: 99 })).ok).toBe(false);
  });

  test("set_suitable cambia solo il flag", async () => {
    const before = await db.execute("SELECT * FROM call_proposals WHERE id = 1");
    await applyAction(db, { type: "set_suitable", proposal_id: 1, value: false });
    const after = await db.execute("SELECT * FROM call_proposals WHERE id = 1");
    expect(after.rows[0].suitable).toBe(0);
    expect({ ...after.rows[0], suitable: 1 }).toEqual({ ...before.rows[0] });
    await applyAction(db, { type: "set_suitable", proposal_id: 1, value: true });
    expect((await db.execute("SELECT suitable FROM call_proposals WHERE id = 1")).rows[0].suitable).toBe(1);
  });

  test("le tabelle protette non cambiano", async () => {
    const snap = async () =>
      JSON.stringify(
        await Promise.all(
          ["contacts", "credits", "contact_regions", "regional_calls", "call_sessions"].map(
            async (t) => (await db.execute(`SELECT * FROM ${t}`)).rows,
          ),
        ),
      );
    const before = await snap();
    await applyAction(db, { type: "prepare_drafts", proposal_id: 1 });
    await applyAction(db, { type: "set_suitable", proposal_id: 1, value: false });
    expect(await snap()).toBe(before);
  });
});
