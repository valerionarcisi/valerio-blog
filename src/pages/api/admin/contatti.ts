import type { APIRoute } from "astro";
import { requireAdmin } from "~/lib/admin-auth";
import getRadarDb, { isRadarConfigured } from "~/lib/radar-db";
import {
  PROJECTS,
  type Project,
  applyAction,
  loadContact,
  loadDraft,
  loadEngine,
  loadPipeline,
  loadToday,
  parseAction,
} from "~/lib/radar-contacts";
import { andThen, jsonErr, jsonOk, parseJsonBody } from "~/lib/result";

export const prerender = false;

const NO_STORE = { "Cache-Control": "no-store" };

function withNoStore(res: Response): Response {
  res.headers.set("Cache-Control", NO_STORE["Cache-Control"]);
  return res;
}

// GET ?view=today | pipeline&project=… | contact&id=… | draft&id=… | engine
export const GET: APIRoute = async ({ request, url }) => {
  const denied = requireAdmin(request);
  if (denied) return denied;
  if (!isRadarConfigured())
    return jsonErr("TURSO_RADAR_URL / TURSO_RADAR_TOKEN non configurati", 503);

  const db = getRadarDb();
  const view = url.searchParams.get("view") ?? "today";
  const id = Number(url.searchParams.get("id"));
  try {
    switch (view) {
      case "today":
        return withNoStore(jsonOk(await loadToday(db)));
      case "pipeline": {
        const project = url.searchParams.get("project") as Project;
        if (!PROJECTS.includes(project))
          return jsonErr("Progetto non valido", 400);
        const min = Math.max(
          0,
          Math.min(100, Number(url.searchParams.get("min")) || 0),
        );
        return withNoStore(jsonOk(await loadPipeline(db, project, min)));
      }
      case "contact": {
        if (!Number.isInteger(id) || id <= 0)
          return jsonErr("id non valido", 400);
        const data = await loadContact(db, id);
        return data
          ? withNoStore(jsonOk(data))
          : jsonErr("Contatto non trovato", 404);
      }
      case "draft": {
        if (!Number.isInteger(id) || id <= 0)
          return jsonErr("id non valido", 400);
        const data = await loadDraft(db, id);
        return data
          ? withNoStore(jsonOk(data))
          : jsonErr("Bozza non trovata", 404);
      }
      case "engine":
        return withNoStore(jsonOk(await loadEngine(db)));
      default:
        return jsonErr("Vista sconosciuta", 400);
    }
  } catch (e) {
    console.error("[admin/contatti] GET", e);
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
    console.error("[admin/contatti] POST", e);
    return jsonErr("Errore del database radar", 502);
  }
};
