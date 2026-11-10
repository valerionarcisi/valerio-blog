import { describe, test, expect } from "vitest";
import { createClient, type Client } from "@libsql/client";
import {
  loadHealth,
  loadOpportunities,
  loadRadarGlanceSafe,
  loadWeek,
  mergeWeek,
  splitOpportunities,
  summarizeHealth,
  toOpportunity,
} from "./radar-opps";

const TODAY = "2026-11-09";

async function seed(): Promise<Client> {
  const db = createClient({ url: ":memory:" });
  await db.batch([
    `CREATE TABLE opportunities (id INTEGER PRIMARY KEY, title TEXT, kind TEXT, organizer TEXT, url TEXT, deadline TEXT, status TEXT,
       amount_text TEXT, location TEXT, eligibility TEXT, summary TEXT, fits TEXT)`,
    `CREATE TABLE deadlines (id INTEGER PRIMARY KEY, name TEXT, type TEXT, deadline TEXT, project TEXT, url TEXT, cost TEXT)`,
    `CREATE TABLE regional_calls (id INTEGER PRIMARY KEY, region TEXT, title TEXT, sheet_kind TEXT, official_url TEXT)`,
    `CREATE TABLE call_sessions (id INTEGER PRIMARY KEY, call_id INTEGER, opens TEXT, closes TEXT, status TEXT)`,
    `CREATE TABLE radar_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, job TEXT, started_at TEXT, status TEXT, note TEXT)`,
    `CREATE TABLE radar_settings (key TEXT PRIMARY KEY, value TEXT)`,
    `INSERT INTO opportunities (id, title, kind, organizer, deadline, status) VALUES
       (1, 'IDS Academy', 'lab', 'IDS', '2026-11-10', 'open'),
       (2, 'Fondo lontano', 'fund', NULL, '2027-05-01', 'open'),
       (3, 'Sempre aperto', 'call', NULL, NULL, 'open'),
       (4, 'Scaduto', 'fund', NULL, '2026-10-01', 'expired'),
       (5, 'Aperto ma passato', 'fund', NULL, '2026-11-01', 'open')`,
    `INSERT INTO deadlines (id, name, type, deadline, project, url, cost) VALUES
       (1, 'IDS Academy', 'lab', '2026-11-10', NULL, NULL, NULL),
       (2, 'Pitch Forum', 'market', '2026-12-01', 'walkie-talkie', NULL, NULL),
       (3, 'Vecchia', 'market', '2026-01-01', NULL, NULL, NULL)`,
    `INSERT INTO regional_calls VALUES (1, 'lazio', 'Lazio Cinema', 'bando', NULL)`,
    `INSERT INTO call_sessions VALUES (1, 1, '2026-10-20', '2026-11-16', NULL)`,
    `INSERT INTO radar_runs (job, started_at, status, note) VALUES
       ('send', '2026-11-08 10:00:00', 'error', 'vecchio'),
       ('send', '2026-11-09 15:35:00', 'error', 'timeout SSL'),
       ('draft', '2026-11-09 06:00:00', 'ok', NULL),
       ('census:fc', '2026-11-09 09:00:00', 'error', 'DNS')`,
    `INSERT INTO radar_settings VALUES ('send_enabled','0'),('paused','0'),
       ('hb_census:fc','2026-11-09 09:00:00'),('hb_requests','2026-11-09 17:00:00'),('hb_send','2026-11-09 17:00:00'),('hb_inbox','2026-11-09 14:00:00')`,
  ]);
  return db;
}

describe("opportunità", () => {
  test("split: aperte datate per scadenza, poi senza data; il resto in passate", () => {
    const list = [
      toOpportunity({ id: 1, title: "a", deadline: "2027-05-01", status: "open" }, TODAY),
      toOpportunity({ id: 2, title: "b", deadline: "2026-11-10", status: "open" }, TODAY),
      toOpportunity({ id: 3, title: "c", deadline: null, status: "open" }, TODAY),
      toOpportunity({ id: 4, title: "d", deadline: "2026-11-01", status: "open" }, TODAY),
      toOpportunity({ id: 5, title: "e", deadline: "2026-10-01", status: "expired" }, TODAY),
    ];
    const s = splitOpportunities(list);
    expect(s.open.map((o) => o.id)).toEqual([2, 1, 3]);
    expect(s.past.map((o) => o.id)).toEqual([4, 5]);
  });

  test("loadOpportunities toglie dall'agenda i doppioni per titolo e le scadute", async () => {
    const r = await loadOpportunities(await seed(), TODAY);
    expect(r.open.map((o) => o.title)).toEqual(["IDS Academy", "Fondo lontano", "Sempre aperto"]);
    expect(r.open[0].days_left).toBe(1);
    expect(r.agenda.map((a) => a.name)).toEqual(["Pitch Forum"]);
    expect(r.agenda[0].days_left).toBe(22);
  });
});

describe("scadenze della settimana", () => {
  test("opportunità e bandi entro 14 giorni, ordinati", async () => {
    const w = await loadWeek(await seed(), TODAY);
    expect(w.map((x) => [x.kind, x.title, x.days_left])).toEqual([
      ["opportunita", "IDS Academy", 1],
      ["bando", "Lazio Cinema", 7],
    ]);
  });
  test("mergeWeek limita", () => {
    const items = Array.from({ length: 9 }, (_, i) => ({
      kind: "bando" as const, title: String(i), detail: "", days_left: 9 - i, href: "/",
    }));
    const m = mergeWeek(items, 3);
    expect(m.map((x) => x.days_left)).toEqual([1, 2, 3]);
  });
});

describe("salute del motore", () => {
  const now = new Date("2026-11-09T17:20:00Z");

  test("segnala errori dell'ultimo giro e battiti fermi", async () => {
    const h = await loadHealth(await seed(), now);
    expect(h.ok).toBe(false);
    expect(h.sending).toBe("spento");
    const text = h.problems.map((p) => `${p.job}: ${p.text}`).join("|");
    expect(text).toContain("census:fc: ultimo giro in errore: DNS");
    expect(text).not.toContain("send:"); // errore alle 15:35, battito delle 17:00: già ripartito
    expect(text).toContain("inbox: nessun battito da 200 minuti");
    expect(text).not.toContain("requests");
    expect(h.jobs.find((j) => j.job === "send")?.note).toBe("timeout SSL");
  });

  test("tutto a posto, invio acceso o in pausa", () => {
    const ok = summarizeHealth(
      [{ job: "draft", status: "ok", started_at: "x" }],
      { send_enabled: "1", paused: "0", hb_requests: "2026-11-09 17:19:00" },
      now,
    );
    expect(ok.ok).toBe(true);
    expect(ok.sending).toBe("attivo");
    expect(summarizeHealth([], { send_enabled: "1", paused: "1" }, now).sending).toBe("in pausa");
  });

  test("battiti assenti o illeggibili non generano allarmi", () => {
    const h = summarizeHealth([], { hb_requests: "boh" }, now);
    expect(h.ok).toBe(true);
    expect(h.last_beat).toBeNull();
  });
});

describe("home: soft failure", () => {
  test("DB rotto → null, non eccezione", async () => {
    const db = createClient({ url: ":memory:" });
    expect(await loadRadarGlanceSafe(db, TODAY)).toBeNull();
  });
});
