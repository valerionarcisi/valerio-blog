import type { APIRoute } from "astro";
import getDb from "~/lib/turso";
import { notifyNewComment, notifyReplyToYourComment } from "~/lib/email";
import { generateStableVisitorHash } from "~/lib/analytics";
import { verifyBearerToken } from "~/lib/auth";
import { env } from "~/lib/env";
import { AUTHOR_NAME, AUTHOR_EMAIL } from "~/lib/author";
import {
  type Result,
  ok,
  err,
  jsonOk,
  jsonErr,
  isNonEmptyString,
  isValidEmail,
} from "~/lib/result";

export const prerender = false;

interface CommentInput {
  pageId: string;
  name: string;
  email: string;
  text: string;
  parentId: number | null;
  lang: "it" | "en";
}

interface AuthorCommentInput {
  pageId: string;
  text: string;
  parentId: number | null;
  lang: "it" | "en";
}

function parseCommentInput(body: unknown): Result<CommentInput | "honeypot"> {
  if (!body || typeof body !== "object") return err("Invalid body");
  const { pageId, name, email, text, website, parentId, lang } = body as Record<
    string,
    unknown
  >;

  if (website) return ok("honeypot" as const);

  if (!isNonEmptyString(pageId)) return err("pageId required");
  if (!isNonEmptyString(name) || name.length > 100) return err("Invalid name");
  if (!isValidEmail(email)) return err("Invalid email");
  if (!isNonEmptyString(text) || text.length > 5000)
    return err("Text too long");

  let parsedParent: number | null = null;
  if (parentId !== undefined && parentId !== null) {
    if (
      typeof parentId !== "number" ||
      !Number.isInteger(parentId) ||
      parentId <= 0
    ) {
      return err("Invalid parentId");
    }
    parsedParent = parentId;
  }

  const parsedLang: "it" | "en" = lang === "en" ? "en" : "it";

  return ok({
    pageId: pageId.trim(),
    name: name.trim(),
    email: email.trim(),
    text: text.trim(),
    parentId: parsedParent,
    lang: parsedLang,
  });
}

function parseAuthorInput(body: unknown): Result<AuthorCommentInput> {
  if (!body || typeof body !== "object") return err("Invalid body");
  const { pageId, text, parentId, lang } = body as Record<string, unknown>;

  if (!isNonEmptyString(pageId)) return err("pageId required");
  if (!isNonEmptyString(text) || text.length > 5000)
    return err("Text too long");

  let parsedParent: number | null = null;
  if (parentId !== undefined && parentId !== null) {
    if (
      typeof parentId !== "number" ||
      !Number.isInteger(parentId) ||
      parentId <= 0
    ) {
      return err("Invalid parentId");
    }
    parsedParent = parentId;
  }

  const parsedLang: "it" | "en" = lang === "en" ? "en" : "it";
  return ok({
    pageId: pageId.trim(),
    text: text.trim(),
    parentId: parsedParent,
    lang: parsedLang,
  });
}

function clientHash(request: Request): Promise<string> {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const ua = request.headers.get("user-agent") ?? "";
  const host = new URL(request.url).hostname;
  return generateStableVisitorHash(host, ip, ua);
}

interface ParentRow {
  page_id: string;
  approved: number;
  name: string;
  email: string;
}

async function loadParent(parentId: number): Promise<ParentRow | null> {
  const res = await getDb().execute({
    sql: "SELECT page_id, approved, name, email FROM comments WHERE id = ?",
    args: [parentId],
  });
  if (res.rows.length === 0) return null;
  return {
    page_id: String(res.rows[0].page_id),
    approved: Number(res.rows[0].approved),
    name: String(res.rows[0].name),
    email: String(res.rows[0].email),
  };
}

export const GET: APIRoute = async ({ url, request }) => {
  const pageId = url.searchParams.get("pageId");
  if (!pageId) return jsonErr("pageId required", 400);

  const visitorHash = await clientHash(request);

  const result = await getDb().execute({
    sql: `SELECT c.id, c.parent_id, c.name, c.text, c.likes_count, c.is_author, c.created_at,
            CASE WHEN cl.id IS NULL THEN 0 ELSE 1 END AS liked_by_me
          FROM comments c
          LEFT JOIN comment_likes cl
            ON cl.comment_id = c.id AND cl.visitor_hash = ?
          WHERE c.page_id = ? AND c.approved = 1
          ORDER BY c.created_at ASC`,
    args: [visitorHash, pageId],
  });

  return jsonOk(result.rows);
};

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErr("Invalid JSON", 400);
  }

  const isAuthor = verifyBearerToken(request, env("ADMIN_TOKEN"));
  if (isAuthor) return handleAuthorPost(body);

  return handlePublicPost(body);
};

async function handlePublicPost(body: unknown): Promise<Response> {
  const parsed = parseCommentInput(body);
  if (!parsed.ok) return jsonErr(parsed.error, 400);
  if (parsed.value === "honeypot") return jsonOk({ ok: true });

  const { pageId, name, email, text, parentId, lang } = parsed.value;

  let parentName: string | null = null;
  if (parentId !== null) {
    const parent = await loadParent(parentId);
    if (parent === null) return jsonErr("Parent not found", 400);
    if (parent.page_id !== pageId)
      return jsonErr("Parent belongs to a different page", 400);
    if (parent.approved !== 1)
      return jsonErr("Cannot reply to a pending comment", 400);
    parentName = parent.name;
  }

  await getDb().execute({
    sql: "INSERT INTO comments (page_id, name, email, text, parent_id, lang) VALUES (?, ?, ?, ?, ?, ?)",
    args: [pageId, name, email, text, parentId, lang],
  });

  notifyNewComment({ pageId, name, email, text, parentId, parentName, lang });

  return jsonOk({ ok: true }, 201);
}

async function handleAuthorPost(body: unknown): Promise<Response> {
  const parsed = parseAuthorInput(body);
  if (!parsed.ok) return jsonErr(parsed.error, 400);

  const { pageId, text, parentId, lang } = parsed.value;

  let parentEmail: string | null = null;
  let parentName: string | null = null;
  if (parentId !== null) {
    const parent = await loadParent(parentId);
    if (parent === null) return jsonErr("Parent not found", 400);
    if (parent.page_id !== pageId)
      return jsonErr("Parent belongs to a different page", 400);
    if (parent.approved !== 1)
      return jsonErr("Cannot reply to a pending comment", 400);
    parentEmail = parent.email;
    parentName = parent.name;
  }

  await getDb().execute({
    sql: `INSERT INTO comments (page_id, name, email, text, parent_id, lang, approved, is_author, notified_approved)
          VALUES (?, ?, ?, ?, ?, ?, 1, 1, 1)`,
    args: [pageId, AUTHOR_NAME, AUTHOR_EMAIL, text, parentId, lang],
  });

  if (parentEmail !== null && parentEmail !== AUTHOR_EMAIL && parentName !== null) {
    notifyReplyToYourComment({
      pageId,
      parentName,
      parentEmail,
      replyName: AUTHOR_NAME,
      replyText: text,
      lang,
    });
  }

  return jsonOk({ ok: true, isAuthor: true }, 201);
}
