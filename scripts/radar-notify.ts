#!/usr/bin/env -S node --import tsx
/**
 * Confronta public/radar.json (working tree) con la versione in HEAD e,
 * se ci sono item con id nuovi, manda una DM Telegram all'owner —
 * impaginata (HTML) con fit %, per chi, perché, azione, scadenza, link.
 *
 * L'agente lo chiama DOPO aver scritto radar.json e PRIMA del commit,
 * così `git show HEAD:...` è ancora la versione precedente.
 *
 * Usage:
 *   TELEGRAM_BOT_TOKEN=xxx TELEGRAM_USER_ID_WHITELIST=123 \
 *   npx tsx scripts/radar-notify.ts
 *
 *   npx tsx scripts/radar-notify.ts --selftest   # diff + impaginazione, niente rete
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

type Item = {
  id: string;
  title: string;
  deadline: string | null;
  link: string;
  source?: string;
  forWho?: string;
  why?: string;
  action?: string;
  whereWhen?: string;
  probability?: number | null;
  tags?: string[];
  status?: string;
};

const RADAR_PATH = "public/radar.json";
const TG_LIMIT = 3500; // sotto il tetto Telegram (4096) con margine

function idsOf(json: string): Item[] {
  try {
    const data = JSON.parse(json);
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

/** Item presenti in `curr` ma non in `prev` (per id). */
export function newItems(prevJson: string, currJson: string): Item[] {
  const prevIds = new Set(idsOf(prevJson).map((i) => i.id));
  return idsOf(currJson).filter((i) => i.id && !prevIds.has(i.id));
}

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function daysLeft(deadline: string | null | undefined): number | null {
  if (!deadline) return null;
  const d = new Date(deadline + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  const n = new Date();
  const today = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  return Math.round((d.getTime() - today) / 86400000);
}

function fitLine(p: number | null | undefined): string {
  if (p === null || p === undefined) return "🎯 <b>Fit con te:</b> —";
  const dot = p >= 55 ? "🟢" : p >= 30 ? "🟡" : "⚪";
  return `🎯 <b>Fit con te:</b> ${p}% ${dot}`;
}

function deadlineLine(deadline: string | null, status?: string): string {
  const dl = daysLeft(deadline);
  if (dl === null) {
    if (status === "in-arrivo")
      return "🗓 <b>Scadenza:</b> <i>in arrivo (prossima call)</i>";
    return "🗓 <b>Scadenza:</b> <i>senza scadenza</i>";
  }
  if (dl < 0) return `🗓 <b>Scadenza:</b> ${esc(deadline!)} <i>(scaduta)</i>`;
  if (dl === 0) return "🗓 <b>Scadenza:</b> <b>oggi</b>";
  return `🗓 <b>Scadenza:</b> ${esc(deadline!)} (tra ${dl} giorn${dl === 1 ? "o" : "i"})`;
}

/**
 * Solo opportunità a cui puoi ancora partecipare: niente scadute
 * (status "scaduta" o deadline passata). In-arrivo e senza-scadenza restano.
 */
function isParticipable(it: Item): boolean {
  if (it.status === "scaduta") return false;
  const dl = daysLeft(it.deadline);
  if (dl !== null && dl < 0) return false;
  return true;
}

function itemBlock(it: Item): string {
  const lines: string[] = [];
  const src = it.source ? ` · <i>${esc(it.source)}</i>` : "";
  lines.push(`🎬 <b>${esc(it.title)}</b>${src}`);
  lines.push(fitLine(it.probability));
  lines.push(deadlineLine(it.deadline, it.status));
  if (it.whereWhen) lines.push(`📍 ${esc(it.whereWhen)}`);
  if (it.forWho) lines.push(`👤 <b>Per chi:</b> ${esc(it.forWho)}`);
  if (it.why) lines.push(`💡 <b>Perché:</b> ${esc(it.why)}`);
  if (it.action) lines.push(`✅ <b>Azione:</b> ${esc(it.action)}`);
  if (it.tags?.length) lines.push(`🏷 ${it.tags.map(esc).join(" · ")}`);
  if (it.link) lines.push(`🔗 <a href="${esc(it.link)}">Apri il bando</a>`);
  return lines.join("\n");
}

function bySortDeadline(a: Item, b: Item): number {
  const da = daysLeft(a.deadline);
  const db = daysLeft(b.deadline);
  if (da === null && db === null) return 0;
  if (da === null) return 1;
  if (db === null) return -1;
  return da - db;
}

/** Uno o più messaggi HTML pronti per Telegram (spezzati sotto il limite). */
export function buildMessages(fresh: Item[]): string[] {
  const header = `📡 <b>Radar opportunità</b> — ${fresh.length} nuove\n<i>ordinate per scadenza</i>`;
  const blocks = [...fresh].sort(bySortDeadline).map(itemBlock);
  const messages: string[] = [];
  let cur = header;
  for (const b of blocks) {
    const cand = `${cur}\n\n${b}`;
    if (cand.length > TG_LIMIT) {
      messages.push(cur);
      cur = b;
    } else {
      cur = cand;
    }
  }
  messages.push(cur);
  return messages;
}

function previousRadar(): string {
  // Baseline di confronto: HEAD di default; override per la notifica manuale
  // (es. HEAD~1 = "notifica ciò che l'ultimo commit ha aggiunto").
  const base = process.env.RADAR_BASE_REF || "HEAD";
  if (!/^[\w./~^@-]+$/.test(base))
    throw new Error(`RADAR_BASE_REF non valido: ${base}`);
  try {
    return execSync(`git show ${base}:${RADAR_PATH}`, { encoding: "utf8" });
  } catch {
    return '{"items":[]}';
  }
}

function ownerChatId(): number {
  const first = (process.env.TELEGRAM_USER_ID_WHITELIST ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .find((n) => Number.isFinite(n));
  if (!first) throw new Error("TELEGRAM_USER_ID_WHITELIST mancante o vuoto");
  return first;
}

async function notify(fresh: Item[]): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN mancante");
  const chatId = ownerChatId();
  for (const text of buildMessages(fresh)) {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      },
    );
    if (!res.ok) {
      throw new Error(
        `Telegram sendMessage ${res.status}: ${await res.text()}`,
      );
    }
  }
}

function selftest(): void {
  const prev = '{"items":[{"id":"a"},{"id":"b"}]}';
  const curr = '{"items":[{"id":"b"},{"id":"c"},{"id":"d"}]}';
  const fresh = newItems(prev, curr).map((i) => i.id);
  console.assert(
    JSON.stringify(fresh) === JSON.stringify(["c", "d"]),
    `atteso [c,d], ottenuto ${JSON.stringify(fresh)}`,
  );
  console.assert(newItems('{"items":[]}', curr).length === 3, "empty prev ⇒ 3");
  console.assert(newItems(curr, curr).length === 0, "same ⇒ 0");

  // Impaginazione: escaping + chunking sotto il limite, nessun item perso.
  const many: Item[] = Array.from({ length: 40 }, (_, i) => ({
    id: `x${i}`,
    title: `Bando <${i}> & C.`,
    deadline: "2026-09-01",
    link: "https://e.x/a",
    forWho: "Registi emergenti",
    why: "Fit alto",
    probability: 60,
  }));
  const msgs = buildMessages(many);
  console.assert(msgs.length > 1, "40 item ⇒ più messaggi");
  console.assert(
    msgs.every((m) => m.length <= 4096),
    "ogni messaggio sotto 4096",
  );
  const total = msgs.join("").split("🎬").length - 1;
  console.assert(total === 40, `attesi 40 item impaginati, trovati ${total}`);
  console.assert(!msgs[0].includes("<0>"), "titolo con < deve essere escapato");

  // Filtro partecipabili: fuori scadute/deadline-passata, dentro aperte/in-arrivo.
  const mix: Item[] = [
    { id: "a", title: "X", deadline: "2020-01-01", link: "", status: "aperta" },
    { id: "b", title: "Y", deadline: null, link: "", status: "scaduta" },
    { id: "c", title: "Z", deadline: "2099-01-01", link: "", status: "aperta" },
    { id: "d", title: "W", deadline: null, link: "", status: "in-arrivo" },
  ];
  const part = mix.filter(isParticipable).map((i) => i.id);
  console.assert(
    JSON.stringify(part) === JSON.stringify(["c", "d"]),
    `partecipabili attesi [c,d], ottenuti ${JSON.stringify(part)}`,
  );
  console.log("radar-notify selftest OK");
}

async function main(): Promise<void> {
  if (process.argv.includes("--selftest")) {
    selftest();
    return;
  }
  const fresh = newItems(
    previousRadar(),
    readFileSync(RADAR_PATH, "utf8"),
  ).filter(isParticipable); // mai scadute; le già-inviate sono escluse dal diff
  if (fresh.length === 0) {
    console.log("Nessuna nuova opportunità partecipabile, nessuna notifica.");
    return;
  }
  await notify(fresh);
  console.log(`Notificate ${fresh.length} nuove opportunità.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
