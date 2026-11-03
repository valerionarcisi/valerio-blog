// Flag derivato dall'indirizzo, niente colonna nel DB del motore: "info@" e simili sono caselle di ufficio,
// il resto (nome.cognome@, mario@) è la posta di una persona.
const GENERIC_LOCAL_PARTS = new Set([
  "info",
  "informazioni",
  "contact",
  "contacts",
  "contatti",
  "contattaci",
  "hello",
  "hi",
  "ciao",
  "mail",
  "email",
  "posta",
  "office",
  "ufficio",
  "segreteria",
  "reception",
  "admin",
  "amministrazione",
  "direzione",
  "produzione",
  "production",
  "productions",
  "distribuzione",
  "distribution",
  "sales",
  "vendite",
  "acquisitions",
  "acquisizioni",
  "submissions",
  "submission",
  "press",
  "stampa",
  "ufficiostampa",
  "marketing",
  "booking",
  "bookings",
  "festival",
  "film",
  "films",
  "cinema",
  "team",
  "general",
  "enquiries",
  "inquiries",
  "support",
  "pec",
  "noreply",
  "no-reply",
]);

export const MAIL_KINDS = ["all", "personal", "generic"] as const;
export type MailKind = (typeof MAIL_KINDS)[number];

export function isGenericEmail(email: string): boolean {
  const local = email.trim().toLowerCase().split("@")[0] ?? "";
  return GENERIC_LOCAL_PARTS.has(local.replace(/[._-]+$/, ""));
}

export function parseMailKind(raw: string | null): MailKind {
  return (MAIL_KINDS as readonly string[]).includes(raw ?? "")
    ? (raw as MailKind)
    : "all";
}

export type EmailFlag = "personal" | "generic" | "none";

export function emailFlag(email: unknown): EmailFlag {
  const e = String(email ?? "");
  if (!e.includes("@")) return "none";
  return isGenericEmail(e) ? "generic" : "personal";
}
