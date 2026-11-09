// Codici regione usati dal motore radar (regional_calls.region, contact_regions.region) → nome.
export const REGIONS: Record<string, string> = {
  abruzzo: "Abruzzo",
  "alto-adige": "Alto Adige",
  basilicata: "Basilicata",
  calabria: "Calabria",
  campania: "Campania",
  "emilia-romagna": "Emilia-Romagna",
  "friuli-venezia-giulia": "Friuli Venezia Giulia",
  lazio: "Lazio",
  liguria: "Liguria",
  lombardia: "Lombardia",
  marche: "Marche",
  molise: "Molise",
  piemonte: "Piemonte",
  puglia: "Puglia",
  sardegna: "Sardegna",
  sicilia: "Sicilia",
  toscana: "Toscana",
  trentino: "Trentino",
  umbria: "Umbria",
  "valle-d-aosta": "Valle d'Aosta",
  veneto: "Veneto",
};

export const regionName = (code: unknown): string => {
  const c = String(code ?? "");
  return REGIONS[c] ?? c;
};

export const isRegionCode = (v: unknown): v is string =>
  typeof v === "string" && /^[a-z-]{2,40}$/.test(v);
