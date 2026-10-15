import type { APIRoute } from "astro";
import { requireAdmin } from "~/lib/admin-auth";
import getDb from "~/lib/turso";
import { jsonErr, jsonOk, parseJsonBody } from "~/lib/result";
import {
  endOfUtcDay,
  invalidateRulesCache,
  parseRuleInput,
} from "~/lib/bot-rules";

export const prerender = false;

const MAX_RULES = 500;

function parseId(body: unknown): number | null {
  const id = (body as { id?: unknown } | null)?.id;
  return typeof id === "number" && Number.isInteger(id) && id > 0 ? id : null;
}

export const GET: APIRoute = async ({ request }) => {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const res = await getDb().execute(
    "SELECT id, kind, value, note, enabled, hits, created_at, expires_at FROM bot_rules ORDER BY enabled DESC, id DESC",
  );
  return jsonOk({ rules: res.rows });
};

export const POST: APIRoute = async ({ request }) => {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const body = await parseJsonBody(request);
  if (!body.ok) return jsonErr(body.error, 400);
  const parsed = parseRuleInput(body.value);
  if (!parsed.ok) return jsonErr(parsed.error, 400);

  const db = getDb();
  const count = await db.execute("SELECT COUNT(*) AS n FROM bot_rules");
  if (Number(count.rows[0].n) >= MAX_RULES)
    return jsonErr("Too many rules", 400);
  const dup = await db.execute({
    sql: "SELECT id FROM bot_rules WHERE kind = ? AND LOWER(value) = LOWER(?) LIMIT 1",
    args: [parsed.kind, parsed.value],
  });
  if (dup.rows.length > 0) return jsonErr("Rule already exists", 409);

  const expiresAt =
    parsed.kind === "hash_today" ? endOfUtcDay(new Date()) : null;
  const res = await db.execute({
    sql: "INSERT INTO bot_rules (kind, value, note, expires_at) VALUES (?, ?, ?, ?)",
    args: [parsed.kind, parsed.value, parsed.note, expiresAt],
  });
  invalidateRulesCache();
  return jsonOk(
    {
      id: Number(res.lastInsertRowid),
      kind: parsed.kind,
      value: parsed.value,
      expires_at: expiresAt,
    },
    201,
  );
};

export const PATCH: APIRoute = async ({ request }) => {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const body = await parseJsonBody(request);
  if (!body.ok) return jsonErr(body.error, 400);
  const id = parseId(body.value);
  const enabled = (body.value as { enabled?: unknown } | null)?.enabled;
  if (id === null || typeof enabled !== "boolean")
    return jsonErr("Expected {id, enabled: boolean}", 400);
  const res = await getDb().execute({
    sql: "UPDATE bot_rules SET enabled = ? WHERE id = ?",
    args: [enabled ? 1 : 0, id],
  });
  if (res.rowsAffected === 0) return jsonErr("Not found", 404);
  invalidateRulesCache();
  return jsonOk({ ok: true });
};

export const DELETE: APIRoute = async ({ request }) => {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const body = await parseJsonBody(request);
  if (!body.ok) return jsonErr(body.error, 400);
  const id = parseId(body.value);
  if (id === null) return jsonErr("Expected {id}", 400);
  const res = await getDb().execute({
    sql: "DELETE FROM bot_rules WHERE id = ?",
    args: [id],
  });
  if (res.rowsAffected === 0) return jsonErr("Not found", 404);
  invalidateRulesCache();
  return jsonOk({ ok: true });
};
