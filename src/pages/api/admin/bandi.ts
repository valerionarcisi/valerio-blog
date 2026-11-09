import type { APIRoute } from "astro";
import { requireAdmin } from "~/lib/admin-auth";
import getRadarDb, { isRadarConfigured } from "~/lib/radar-db";
import {
  applyAction,
  loadArchive,
  loadOverview,
  loadProposal,
  loadRegion,
  loadRequest,
  parseAction,
} from "~/lib/radar-calls";
import { isRegionCode } from "~/lib/radar-regions";
import { andThen, jsonErr, jsonOk, parseJsonBody } from "~/lib/result";

export const prerender = false;

function noStore(res: Response): Response {
  res.headers.set("Cache-Control", "no-store");
  return res;
}

// GET ?view=overview | proposal&id=… | region&code=… | archive | request&id=…
export const GET: APIRoute = async ({ request, url }) => {
  const denied = requireAdmin(request);
  if (denied) return denied;
  if (!isRadarConfigured())
    return jsonErr("TURSO_RADAR_URL / TURSO_RADAR_TOKEN non configurati", 503);

  const db = getRadarDb();
  const id = Number(url.searchParams.get("id"));
  const validId = Number.isInteger(id) && id > 0;
  try {
    switch (url.searchParams.get("view") ?? "overview") {
      case "overview":
        return noStore(jsonOk(await loadOverview(db)));
      case "archive":
        return noStore(jsonOk(await loadArchive(db)));
      case "proposal": {
        if (!validId) return jsonErr("id non valido", 400);
        const data = await loadProposal(db, id);
        return data
          ? noStore(jsonOk(data))
          : jsonErr("Proposta non trovata", 404);
      }
      case "region": {
        const code = url.searchParams.get("code");
        if (!isRegionCode(code)) return jsonErr("Regione non valida", 400);
        return noStore(jsonOk(await loadRegion(db, code)));
      }
      case "request": {
        if (!validId) return jsonErr("id non valido", 400);
        const data = await loadRequest(db, id);
        return data
          ? noStore(jsonOk(data))
          : jsonErr("Richiesta non trovata", 404);
      }
      default:
        return jsonErr("Vista sconosciuta", 400);
    }
  } catch (e) {
    console.error("[admin/bandi] GET", e);
    return jsonErr("Errore del database radar", 502);
  }
};

export const POST: APIRoute = async ({ request }) => {
  const denied = requireAdmin(request);
  if (denied) return denied;
  if (!isRadarConfigured())
    return jsonErr("TURSO_RADAR_URL / TURSO_RADAR_TOKEN non configurati", 503);

  const parsed = andThen(await parseJsonBody(request), parseAction);
  if (!parsed.ok) return jsonErr(parsed.error, 400);
  try {
    const res = await applyAction(getRadarDb(), parsed.value);
    return res.ok ? jsonOk(res.value) : jsonErr(res.error, 409);
  } catch (e) {
    console.error("[admin/bandi] POST", e);
    return jsonErr("Errore del database radar", 502);
  }
};
