#!/usr/bin/env -S node --import tsx
/**
 * Confronta public/radar.json (working tree) con la versione in HEAD e,
 * se ci sono item con id nuovi, manda una DM Telegram all'owner.
 *
 * L'agente giornaliero lo chiama DOPO aver scritto radar.json e PRIMA del commit,
 * così `git show HEAD:...` è ancora la versione precedente.
 *
 * Usage:
 *   TELEGRAM_BOT_TOKEN=xxx TELEGRAM_USER_ID_WHITELIST=123 \
 *   pnpm tsx scripts/radar-notify.ts
 *
 *   pnpm tsx scripts/radar-notify.ts --selftest   # verifica la diff, niente rete
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

type Item = {
  id: string;
  title: string;
  deadline: string | null;
  link: string;
};

const RADAR_PATH = "public/radar.json";

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

function previousRadar(): string {
  try {
    return execSync(`git show HEAD:${RADAR_PATH}`, { encoding: "utf8" });
  } catch {
    // Primo giro: il file non è ancora in HEAD → nessun "precedente".
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
  const lines = fresh.map((i) => {
    const when = i.deadline ? ` — scad. ${i.deadline}` : "";
    return `• ${i.title}${when}\n${i.link}`;
  });
  const text = `📡 Radar: ${fresh.length} nuova/e opportunità\n\n${lines.join("\n\n")}`;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: ownerChatId(),
      text,
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    throw new Error(`Telegram sendMessage ${res.status}: ${await res.text()}`);
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
  // Nessun precedente ⇒ tutti nuovi.
  console.assert(newItems('{"items":[]}', curr).length === 3, "empty prev ⇒ 3");
  // Nessuna novità ⇒ vuoto.
  console.assert(newItems(curr, curr).length === 0, "same ⇒ 0");
  console.log("radar-notify selftest OK");
}

async function main(): Promise<void> {
  if (process.argv.includes("--selftest")) {
    selftest();
    return;
  }
  const fresh = newItems(previousRadar(), readFileSync(RADAR_PATH, "utf8"));
  if (fresh.length === 0) {
    console.log("Nessuna nuova opportunità, nessuna notifica.");
    return;
  }
  await notify(fresh);
  console.log(`Notificate ${fresh.length} nuove opportunità.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
