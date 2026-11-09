import { type Confidence, type Proposal } from "~/lib/radar-calls";

const MONTHS = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

export function fmtDate(iso: unknown): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  if (!m) return "—";
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1].slice(0, 3)} ${m[1]}`;
}

export function fmtMonth(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : ym;
}

export const PROJECT_LABEL: Record<string, string> = {
  "non-fa-ridere": "Non fa ridere",
  "walkie-talkie": "Walkie Talkie",
};
export const PROJECT_CHIP: Record<string, string> = {
  "non-fa-ridere": "nfr",
  "walkie-talkie": "wt",
};

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  annunciata: "Annunciata",
  alta: "Alta",
  media: "Media",
  bassa: "Bassa",
};

export function confidenceText(c: Confidence | null): string {
  return c ? CONFIDENCE_LABEL[c] : "n.d.";
}

export function windowText(p: Pick<Proposal, "window" | "days_to_open">): string {
  if (!p.window || p.days_to_open === null) return "";
  switch (p.window.state) {
    case "future":
      return `finestra dal ${fmtDate(p.window.from)}`;
    case "now":
      return `in finestra fino al ${fmtDate(p.window.to)}`;
    case "closing":
      return `finestra chiusa, apre tra ${p.days_to_open} giorni`;
    default:
      return "apertura passata";
  }
}

export const STAGE_LABEL: Record<string, string> = {
  "to-contact": "Da contattare",
  draft: "Bozza pronta",
  contacted: "Inviata",
  followup: "Follow-up",
  replied: "Risposta",
  warm: "Calda",
  "on-hold": "In attesa",
  discarded: "Scartata",
};

export const MAIL_LABEL: Record<string, string> = {
  personal: "personale",
  generic: "info@",
  none: "senza email",
};
