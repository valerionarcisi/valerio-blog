import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { makeChallenge, resetContactCache, solveChallenge } from "~/lib/contact";

let db: Client;
let resendKey = "re_test";
vi.mock("~/lib/turso", () => ({ default: () => db }));
vi.mock("~/lib/env", () => ({
  env: (k: string) => (k === "ADMIN_TOKEN" ? "admin-secret" : k === "RESEND_API_KEY" ? resendKey : ""),
}));

const { POST } = await import("~/pages/api/contact");
const { GET: CHALLENGE } = await import("~/pages/api/contact/challenge");

const sent: { url: string; body: Record<string, unknown> }[] = [];
let resendOk = true;

beforeEach(async () => {
  db = createClient({ url: ":memory:" });
  resetContactCache();
  resendKey = "re_test";
  resendOk = true;
  sent.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: { body: string }) => {
      sent.push({ url, body: JSON.parse(init.body) });
      return { ok: resendOk } as Response;
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

function fresh() {
  const challenge = makeChallenge("admin-secret");
  return { challenge, nonce: solveChallenge(challenge) };
}
const message = { name: "Anna Rossi", email: "anna@example.com", message: "Ciao Valerio, ti scrivo per una sceneggiatura." };

function post(body: unknown, opts: { origin?: string | null; ip?: string; raw?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json", "x-nf-client-connection-ip": opts.ip ?? "203.0.113.5" };
  if (opts.origin !== null) headers.origin = opts.origin ?? "https://valerionarcisi.me";
  return POST({
    request: new Request("https://valerionarcisi.me/api/contact", {
      method: "POST",
      headers,
      body: opts.raw ?? JSON.stringify(body),
    }),
  } as never);
}
const json = async (r: Response) => (await r.json()) as Record<string, unknown>;

describe("GET /api/contact/challenge", () => {
  test("returns a signed challenge, never cached", async () => {
    const res = await CHALLENGE({ request: new Request("https://valerionarcisi.me/api/contact/challenge", { headers: { "x-nf-client-connection-ip": "1.1.1.1" } }) } as never);
    const body = await json(res);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(String(body.challenge).split(".")).toHaveLength(3);
    expect(body.bits).toBe(13);
  });
});

describe("POST /api/contact", () => {
  test("a valid message is e-mailed to the owner with reply-to and a safe subject", async () => {
    const res = await post({ ...message, name: "Anna\r\nBcc: evil@example.com", topic: "film", ...fresh() });
    // the name with a line break is rejected up front: use a clean name for the success path below
    expect(res.status).toBe(400);
    const ok = await post({ ...message, topic: "film", ...fresh() });
    expect(ok.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe("https://api.resend.com/emails");
    expect(sent[0].body).toMatchObject({
      to: "valerio.narcisi@gmail.com",
      reply_to: "anna@example.com",
      subject: "[Film / sceneggiatura] Nuovo messaggio da Anna Rossi",
    });
    expect(String(sent[0].body.text)).toContain("sceneggiatura");
  });

  test("HTML in the message is escaped in the e-mail body", async () => {
    await post({ ...message, message: "<script>alert(1)</script> ciao Valerio, scrivo per lavoro", ...fresh() });
    const html = String(sent[0].body.html);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  test("foreign or missing origin is forbidden and nothing is sent", async () => {
    expect((await post({ ...message, ...fresh() }, { origin: "https://evil.example" })).status).toBe(403);
    expect((await post({ ...message, ...fresh() }, { origin: null })).status).toBe(403);
    expect(sent).toHaveLength(0);
  });

  test("a Referer from our site is accepted when Origin is absent", async () => {
    const res = await POST({
      request: new Request("https://valerionarcisi.me/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json", referer: "https://valerionarcisi.me/contatti/", "x-nf-client-connection-ip": "9.9.9.9" },
        body: JSON.stringify({ ...message, ...fresh() }),
      }),
    } as never);
    expect(res.status).toBe(200);
  });

  test("honeypot: looks fine to the bot, sends nothing", async () => {
    const res = await post({ ...message, website: "http://spam.example", ...fresh() });
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(0);
  });

  test("spam gets a clear 422 so a real person can rephrase", async () => {
    const res = await post({ ...message, message: "Cheap viagra online, buy now here today please", ...fresh() });
    expect(res.status).toBe(422);
    expect(sent).toHaveLength(0);
  });

  test("no proof of work, a wrong one, or an expired challenge: 400", async () => {
    expect((await post(message)).status).toBe(400);
    const { challenge } = fresh();
    expect((await post({ ...message, challenge, nonce: "nope!" })).status).toBe(400);
    const old = makeChallenge("admin-secret", Date.now() - 3 * 3600 * 1000);
    const res = await post({ ...message, challenge: old, nonce: solveChallenge(old) });
    expect(res.status).toBe(400);
    expect((await json(res)).error).toBe("expired");
    expect(sent).toHaveLength(0);
  });

  test("a challenge works once: replaying it is refused", async () => {
    const c = fresh();
    expect((await post({ ...message, ...c })).status).toBe(200);
    expect((await post({ ...message, ...c })).status).toBe(400);
    expect(sent).toHaveLength(1);
  });

  test("rate limit: 3 per 10 minutes per visitor", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await post({ ...message, ...fresh() }, { ip: "198.51.100.7" })).status);
    expect(codes).toEqual([200, 200, 200, 429, 429]);
    expect(sent).toHaveLength(3);
    // another visitor is not affected
    expect((await post({ ...message, ...fresh() }, { ip: "198.51.100.8" })).status).toBe(200);
  });

  test("if the mail service fails the visitor is told and can retry", async () => {
    resendOk = false;
    const res = await post({ ...message, ...fresh() });
    expect(res.status).toBe(502);
    expect((await json(res)).error).toBe("send_failed");
  });

  test("without a Resend key the form reports it is not configured", async () => {
    resendKey = "";
    const res = await post({ ...message, ...fresh() });
    expect(res.status).toBe(503);
  });

  test("oversized or malformed bodies are refused", async () => {
    expect((await post(null, { raw: "{not json" })).status).toBe(400);
    const big = await POST({
      request: new Request("https://valerionarcisi.me/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://valerionarcisi.me", "content-length": "99999" },
        body: "{}",
      }),
    } as never);
    expect(big.status).toBe(413);
  });
});
