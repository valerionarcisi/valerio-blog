import type { APIRoute } from "astro";
import getDb from "~/lib/turso";
import { generateStableVisitorHash } from "~/lib/analytics";
import { jsonOk, jsonErr, parseJsonBody } from "~/lib/result";
import { parseNewScore, submitScore, topScores } from "~/lib/leaderboard-api";

export const prerender = false;

function clientHash(request: Request): Promise<string> {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const ua = request.headers.get("user-agent") ?? "";
  const host = new URL(request.url).hostname;
  return generateStableVisitorHash(host, ip, ua);
}

export const GET: APIRoute = async () => {
  const scores = await topScores(getDb());
  return jsonOk({ scores });
};

export const POST: APIRoute = async ({ request }) => {
  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.ok) return jsonErr(bodyResult.error, 400);

  const parsed = parseNewScore(bodyResult.value);
  if (!parsed.ok) return jsonErr(parsed.error, 400);

  const visitorHash = await clientHash(request);
  await submitScore(getDb(), parsed.value, visitorHash);

  const scores = await topScores(getDb());
  return jsonOk({ scores });
};
