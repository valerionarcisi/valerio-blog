#!/usr/bin/env node
/**
 * Ricerca settimanale (Haiku + web search) → riscrive public/radar.json.
 * Chiamato dal workflow .github/workflows/radar-weekly.yml. Vedi docs/radar-agent.md.
 *
 * Zero dipendenze: parla con l'API Anthropic via fetch.
 * Env richiesti: ANTHROPIC_API_KEY.
 *
 * Fail-safe: se la risposta non è un JSON valido con items non vuoto, esce 1
 * SENZA sovrascrivere il file esistente (meglio dati vecchi che dati distrutti).
 */

import { readFileSync, writeFileSync } from "node:fs";

const RADAR_PATH = "public/radar.json";
const MODEL = "claude-haiku-4-5";
const API = "https://api.anthropic.com/v1/messages";

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`${name} mancante`);
    process.exit(1);
  }
  return v;
}

function currentRadar() {
  try {
    return readFileSync(RADAR_PATH, "utf8");
  } catch {
    return '{"items":[]}';
  }
}

function buildMessages() {
  const today = new Date().toISOString().slice(0, 10);
  const system = [
    "Sei l'agente Radar: cerchi bandi/opportunità cinema (workshop, call, pitch forum,",
    "fondi di sviluppo, lab, premi festival, residenze) rilevanti per un REGISTA",
    "EMERGENTE con corti che è anche SCENEGGIATORE.",
    "",
    "SCOPRI FONTI IN AUTONOMIA. Questi sono solo semi, NON un elenco chiuso:",
    "OnlyFUNDS, Collettivo Incendio, European Short Pitch (NISI MASA), Creative Europe",
    "MEDIA, Cineuropa, ShorTO, TorinoFilmLab, Premio Solinas, Biennale College Cinema,",
    "Berlinale Talents, Locarno Open Doors, MIA Market, Alice nella Città,",
    "Clermont-Ferrand, film commission regionali, bandi MIC, FilmFreeway.",
    "Usa web search anche per TROVARE NUOVI AGGREGATORI (siti, newsletter, canali",
    "Telegram, bacheche) che raccolgono bandi cinema per registi/sceneggiatori",
    "emergenti, e pesca opportunità da quelli. Aggiungi quanti più aggregatori",
    "rilevanti trovi. Per ogni opportunità valorizza sempre 'source' (l'aggregatore",
    "o l'ente da cui viene). Scarta ciò che non è pertinente o è puro spam.",
    "",
    "Restituisci SOLO un oggetto JSON (nessun testo attorno) con questa forma:",
    '{"items":[{"id","title","what","forWho","deadline","whereWhen","probability",',
    '"why","action","link","source","tags","status"}]}',
    "Regole campi:",
    "- id: slug stabile e univoco (es. european-short-pitch-2027). NON cambiarlo tra run:",
    "  gli id già presenti vanno mantenuti identici.",
    "- deadline: 'YYYY-MM-DD' oppure null. Marca status 'scaduta' se la deadline è passata",
    `  (oggi è ${today}); non cancellare le scadute, restano come riferimento.`,
    "- probability: intero 0-100 (stima onesta di quanto vale candidarsi) o null.",
    "- tags: sottoinsieme di online|hybrid|in-person|gratis|a-pagamento (+ liberi).",
    "- status: aperta|in-arrivo|scaduta.",
    "Parti dagli item correnti, aggiornali e aggiungi le novità che trovi.",
  ].join("\n");

  const user = `Item correnti (radar.json):\n${currentRadar()}\n\nAggiorna e restituisci il JSON completo.`;
  return { system, user };
}

async function callAnthropic(apiKey) {
  const { system, user } = buildMessages();
  // ponytail: variante web_search "basic" 20250305 — Haiku 4.5 non supporta la
  // 20260209 (dynamic filtering, solo Opus/Sonnet recenti).
  const tools = [
    { type: "web_search_20250305", name: "web_search", max_uses: 12 },
  ];
  const messages = [{ role: "user", content: user }];

  // Il web search gira server-side: il loop serve solo a gestire pause_turn.
  for (let i = 0; i < 6; i++) {
    const res = await fetch(API, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        system,
        messages,
        tools,
      }),
    });
    if (!res.ok) {
      throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    if (data.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: data.content });
      continue;
    }
    return (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
  }
  throw new Error("Troppi pause_turn: web search non converge");
}

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Nessun JSON nella risposta");
  return JSON.parse(text.slice(start, end + 1));
}

async function main() {
  const apiKey = requireEnv("ANTHROPIC_API_KEY");
  const text = await callAnthropic(apiKey);
  const parsed = extractJson(text);
  if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
    throw new Error("items mancante o vuoto — non sovrascrivo il file");
  }
  if (parsed.items.some((it) => !it.id)) {
    throw new Error("item senza id — non sovrascrivo il file");
  }
  // updatedAt lo mette lo script (autoritativo), non il modello.
  const out = { updatedAt: new Date().toISOString(), items: parsed.items };
  writeFileSync(RADAR_PATH, JSON.stringify(out, null, 2) + "\n");
  console.log(`radar.json aggiornato: ${parsed.items.length} opportunità`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
