import { describe, test, expect, beforeEach } from "vitest";
import { createClient, type Client } from "@libsql/client";
import {
  applyAction,
  domainOf,
  loadContact,
  loadPipeline,
  loadToday,
  parseAction,
} from "./radar-contacts";

async function seed(): Promise<Client> {
  const db = createClient({ url: ":memory:" });
  await db.batch(
    [
      `CREATE TABLE contacts (id INTEGER PRIMARY KEY, name TEXT, type TEXT, country TEXT, city TEXT, email TEXT,
       official_url TEXT, verification_level TEXT, contact_proof TEXT, status TEXT, project TEXT, notes TEXT,
       contacted_at TEXT, created_at TEXT DEFAULT (datetime('now')))`,
      `CREATE TABLE radar_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, contact_id INTEGER, project TEXT, outbox_id INTEGER,
       url TEXT, status TEXT DEFAULT 'pending', note TEXT, created_at TEXT DEFAULT (datetime('now')), done_at TEXT)`,
      `CREATE TABLE people (id INTEGER PRIMARY KEY AUTOINCREMENT, contact_id INTEGER, name TEXT, role TEXT, email TEXT,
       email_confidence TEXT, linkedin_search TEXT, instagram_search TEXT)`,
      `CREATE TABLE contact_projects (contact_id INTEGER, project TEXT, score INTEGER, score_detail TEXT, reason TEXT,
       shortlist INTEGER DEFAULT 0, stage TEXT DEFAULT 'to-contact', scored_at TEXT, updated_at TEXT, PRIMARY KEY (contact_id, project))`,
      `CREATE TABLE radar_outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, contact_id INTEGER, project TEXT, kind TEXT DEFAULT 'first',
       to_email TEXT, subject TEXT, body TEXT, hook TEXT, lang TEXT, status TEXT DEFAULT 'draft', error TEXT,
       created_at TEXT DEFAULT (datetime('now')), approved_at TEXT, sent_at TEXT, message_id TEXT)`,
      `CREATE TABLE radar_runs (id INTEGER PRIMARY KEY, job TEXT, started_at TEXT, finished_at TEXT, status TEXT, found INTEGER, errors INTEGER, note TEXT)`,
      `CREATE TABLE radar_sources (id INTEGER PRIMARY KEY, name TEXT, url TEXT, kind TEXT, project TEXT, active INTEGER, last_run TEXT, found_total INTEGER)`,
      `CREATE TABLE radar_settings (key TEXT PRIMARY KEY, value TEXT)`,
      `CREATE TABLE radar_events (id INTEGER PRIMARY KEY AUTOINCREMENT, contact_id INTEGER, project TEXT, kind TEXT, detail TEXT, at TEXT DEFAULT (datetime('now')))`,
      `INSERT INTO radar_settings VALUES ('send_enabled','0'),('paused','0'),('daily_cap','25'),('followup_days','10'),('max_followups','2')`,
      `INSERT INTO contacts (id, name, email, official_url, status, verification_level) VALUES
       (1, 'Premiere Film', 'dist@premiere.example', 'https://www.premiere.example/it/', 'to-contact', 'verified'),
       (2, '[DIST] Premiere Film', NULL, 'https://premiere.example/', 'contacted', NULL),
       (3, 'Kidam', 'kidam@kidam.example', 'https://kidam.example', 'to-contact', 'verified')`,
      `INSERT INTO contacts (id, name, email, status, contacted_at) VALUES
       (5, 'Vecchia Casa', 'a@old.example', 'contacted', datetime('now', '-30 days')),
       (6, 'Casa Recente', 'b@new.example', 'contacted', datetime('now', '-2 days')),
       (7, 'Gia Sollecitata', 'c@twice.example', 'follow-up-2', datetime('now', '-40 days')),
       (8, 'Con Bozza', 'd@draft.example', 'contacted', datetime('now', '-30 days')),
       (9, 'Senza Email', NULL, 'to-contact', NULL)`,
      `INSERT INTO contact_projects (contact_id, project, score, stage, shortlist) VALUES
       (1, 'non-fa-ridere', 90, 'draft', 0), (3, 'walkie-talkie', 84, 'to-contact', 1),
       (5, 'walkie-talkie', NULL, 'contacted', 0), (6, 'walkie-talkie', NULL, 'contacted', 0),
       (7, 'walkie-talkie', NULL, 'followup', 0), (8, 'walkie-talkie', NULL, 'contacted', 0),
       (9, 'walkie-talkie', NULL, 'to-contact', 0)`,
      `INSERT INTO radar_outbox (id, contact_id, project, to_email, subject, body, status) VALUES
       (11, 8, 'walkie-talkie', 'd@draft.example', 'Follow-up', 'Ciao', 'draft')`,
      `INSERT INTO radar_outbox (id, contact_id, project, to_email, subject, body) VALUES
       (10, 1, 'non-fa-ridere', 'dist@premiere.example', 'Non fa ridere', 'Ciao, screener: [link screener]')`,
    ],
    "write",
  );
  return db;
}

describe("parseAction", () => {
  test("accepts known actions and rejects bad input", () => {
    expect(parseAction({ action: "draft_approve", id: 3 }).ok).toBe(true);
    expect(parseAction({ action: "draft_approve", id: -1 }).ok).toBe(false);
    expect(
      parseAction({
        action: "stage",
        contact_id: 1,
        project: "walkie-talkie",
        stage: "replied",
      }).ok,
    ).toBe(true);
    expect(
      parseAction({
        action: "stage",
        contact_id: 1,
        project: "altro",
        stage: "replied",
      }).ok,
    ).toBe(false);
    expect(
      parseAction({
        action: "stage",
        contact_id: 1,
        project: "walkie-talkie",
        stage: "sent",
      }).ok,
    ).toBe(false);
    expect(parseAction({ action: "nope" }).ok).toBe(false);
  });

  test("setting keys are whitelisted and bounded", () => {
    expect(
      parseAction({ action: "setting", key: "daily_cap", value: 30 }).ok,
    ).toBe(true);
    expect(
      parseAction({ action: "setting", key: "daily_cap", value: 500 }).ok,
    ).toBe(false);
    expect(
      parseAction({ action: "setting", key: "llm_daily_calls", value: 40 }).ok,
    ).toBe(true);
    expect(
      parseAction({ action: "setting", key: "llm_daily_calls", value: 5000 })
        .ok,
    ).toBe(false);
    expect(
      parseAction({ action: "setting", key: "send_enabled", value: 2 }).ok,
    ).toBe(false);
    expect(
      parseAction({ action: "setting", key: "drop_table", value: 1 }).ok,
    ).toBe(false);
  });

  test("draft_update validates the recipient", () => {
    expect(
      parseAction({
        action: "draft_update",
        id: 1,
        subject: "a",
        body: "b",
        to_email: "nope",
      }).ok,
    ).toBe(false);
    expect(
      parseAction({
        action: "draft_update",
        id: 1,
        subject: "a",
        body: "b",
        to_email: "a@b.it",
      }).ok,
    ).toBe(true);
  });
});

describe("drafts", () => {
  let db: Client;
  beforeEach(async () => {
    db = await seed();
  });

  test("approve refuses while placeholders remain, then queues after the edit", async () => {
    const refused = await applyAction(db, { type: "draft_approve", id: 10 });
    expect(refused.ok).toBe(false);
    await applyAction(db, {
      type: "draft_update",
      id: 10,
      subject: "Non fa ridere",
      body: "Ciao, lo screener arriva a novembre.",
      to_email: "dist@premiere.example",
    });
    expect((await applyAction(db, { type: "draft_approve", id: 10 })).ok).toBe(
      true,
    );
    const row = (
      await db.execute(
        "SELECT status, approved_at FROM radar_outbox WHERE id = 10",
      )
    ).rows[0];
    expect(row.status).toBe("approved");
    expect(row.approved_at).not.toBeNull();
    expect(
      (
        await applyAction(db, {
          type: "draft_update",
          id: 10,
          subject: "x",
          body: "y",
          to_email: "a@b.it",
        })
      ).ok,
    ).toBe(false);
    expect(
      (await applyAction(db, { type: "draft_unapprove", id: 10 })).ok,
    ).toBe(true);
  });

  test("the draft stage cannot be set by hand", async () => {
    const res = await applyAction(db, {
      type: "stage",
      contact_id: 3,
      project: "walkie-talkie",
      stage: "draft",
    });
    expect(res.ok).toBe(false);
    expect(
      (
        await db.execute(
          "SELECT stage FROM contact_projects WHERE contact_id = 3",
        )
      ).rows[0].stage,
    ).toBe("to-contact");
  });

  test("discard puts the contact on hold so the engine does not redraft it", async () => {
    await applyAction(db, { type: "draft_discard", id: 10 });
    const stage = (
      await db.execute(
        "SELECT stage FROM contact_projects WHERE contact_id = 1",
      )
    ).rows[0].stage;
    expect(stage).toBe("on-hold");
  });

  test("marking replied cancels pending drafts and mirrors the status", async () => {
    await applyAction(db, {
      type: "stage",
      contact_id: 1,
      project: "non-fa-ridere",
      stage: "replied",
    });
    expect(
      (await db.execute("SELECT status FROM radar_outbox WHERE id = 10"))
        .rows[0].status,
    ).toBe("cancelled");
    expect(
      (await db.execute("SELECT status FROM contacts WHERE id = 1")).rows[0]
        .status,
    ).toBe("replied");
  });
});

describe("requests for the engine", () => {
  let db: Client;
  beforeEach(async () => {
    db = await seed();
  });
  const pending = async () =>
    (await db.execute("SELECT kind, status FROM radar_requests")).rows;

  test("parseAction validates each kind", () => {
    expect(
      parseAction({
        action: "request",
        kind: "draft",
        contact_id: 3,
        project: "walkie-talkie",
      }).ok,
    ).toBe(true);
    expect(
      parseAction({
        action: "request",
        kind: "followup",
        contact_id: 3,
        project: "altro",
      }).ok,
    ).toBe(false);
    expect(
      parseAction({ action: "request", kind: "shorten", outbox_id: 10 }).ok,
    ).toBe(true);
    expect(parseAction({ action: "request", kind: "translate" }).ok).toBe(
      false,
    );
    expect(
      parseAction({
        action: "request",
        kind: "add_house",
        contact_id: 3,
        project: "walkie-talkie",
      }).ok,
    ).toBe(false);
  });

  test("queues once and answers 'already running' on a repeat", async () => {
    const a = {
      type: "request",
      kind: "draft",
      contact_id: 3,
      project: "walkie-talkie",
    } as const;
    expect((await applyAction(db, a)).ok).toBe(true);
    const again = await applyAction(db, a);
    expect(again.ok && again.value.done).toMatch(/già in corso/);
    expect(await pending()).toHaveLength(1);
  });

  test("refuses a house without email and a house that already has an open draft", async () => {
    expect(
      (
        await applyAction(db, {
          type: "request",
          kind: "draft",
          contact_id: 9,
          project: "walkie-talkie",
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await applyAction(db, {
          type: "request",
          kind: "followup",
          contact_id: 8,
          project: "walkie-talkie",
        })
      ).ok,
    ).toBe(false);
    expect(await pending()).toHaveLength(0);
  });

  test("rewrite requests only apply to drafts that are not queued yet", async () => {
    expect(
      (
        await applyAction(db, {
          type: "request",
          kind: "shorten",
          outbox_id: 10,
        })
      ).ok,
    ).toBe(true);
    await db.execute(
      "UPDATE radar_outbox SET status = 'approved' WHERE id = 10",
    );
    expect(
      (
        await applyAction(db, {
          type: "request",
          kind: "translate",
          outbox_id: 10,
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await applyAction(db, {
          type: "request",
          kind: "translate",
          outbox_id: 999,
        })
      ).ok,
    ).toBe(false);
  });
});

describe("due follow-ups", () => {
  test("lists only overdue, not yet chased twice, without an open draft", async () => {
    const db = await seed();
    const today = await loadToday(db);
    expect(today.due.map((d) => d.name)).toEqual(["Vecchia Casa"]);
  });

  test("a pending request shows up in today's data", async () => {
    const db = await seed();
    await applyAction(db, {
      type: "request",
      kind: "followup",
      contact_id: 5,
      project: "walkie-talkie",
    });
    const today = await loadToday(db);
    expect(today.requests.map((r) => r.kind)).toEqual(["followup"]);
  });
});

describe("reads", () => {
  test("today, pipeline and contact with duplicates", async () => {
    const db = await seed();
    const today = await loadToday(db);
    expect(today.drafts).toHaveLength(2);
    expect(Number(today.counts.drafts)).toBe(2);
    const pipe = await loadPipeline(db, "walkie-talkie", 50);
    expect(
      pipe.columns.find((c) => c.stage === "to-contact")?.cards[0].name,
    ).toBe("Kidam");
    const card = await loadContact(db, 1);
    expect(card?.duplicates.map((d) => d.id)).toEqual([2]);
    expect(await loadContact(db, 999)).toBeNull();
  });

  test("domainOf strips www and tolerates junk", () => {
    expect(domainOf("https://www.Premiere.example/it/")).toBe(
      "premiere.example",
    );
    expect(domainOf("non un url")).toBe("");
  });
});
