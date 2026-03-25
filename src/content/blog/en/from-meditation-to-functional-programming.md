---
title: "From meditation to functional programming: Result, Pipe, and an uncomfortable question about frameworks"
date: "2026-03-25"
extract: "I just wanted to track my meditation sessions. I ended up rethinking how I write code, adopting functional patterns like Result and Pipe. And I asked myself an uncomfortable question."
tags:
  - "javascript"
  - "typescript"
  - "functional-programming"
  - "astro"
  - "meditation"
coverImage: "/img/blog/dalla-meditazione-alla-programmazione-funzionale/cover.jpg"
coverAuthorName: "Luca Bravo"
coverAuthorLink: "https://unsplash.com/@lucabravo"
---

It all started from a simple need: I wanted to meditate every day and keep track of it.

I built a page on my site — a timer, a GitHub-style heatmap, some stats. At first, the data lived in `localStorage`. It worked, until I tried opening the page from my phone: nothing. The data was stuck in my laptop's browser. Obvious, in hindsight.

So I moved everything to Turso, an edge SQLite database, with API endpoints to read and write sessions. And that's where the real journey began.

## The endpoint chaos

The first endpoint to save a meditation session was written the way I always write server-side TypeScript:

```typescript
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { date, duration_min, session_type } = body;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return new Response(
        JSON.stringify({ error: "Valid date required" }),
        { status: 400 }
      );
    }

    await db.execute({
      sql: "INSERT INTO meditation_sessions ...",
      args: [date, duration_min ?? 0, session_type ?? null],
    });

    return new Response(JSON.stringify({ ok: true }), { status: 201 });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Server error" }),
      { status: 500 }
    );
  }
};
```

It works. But then I added the comments endpoint. Then the contact form. Then the admin bot. And I found myself with four files all doing the same thing: `try/catch`, inline validation, `new Response(JSON.stringify(...))` copy-pasted everywhere.

The code was correct but **fragile**. Each endpoint was its own world. If I forgot a check, no compile error. If I changed the response format, I had to hunt it down across four files.

But the real problem was the errors I couldn't see. What happens if the client sends `duration_min: "ten"` instead of `10`? The code above inserts it into the database without flinching — `"ten" ?? 0` gives `"ten"`, not `0`. And what if `session_type` is 10,000 characters long? Or if `date` is `"2026-13-45"`? All cases that try/catch doesn't catch because they're technically not exceptions. They're bad data that enters the system silently and explodes later, when it's too late to understand where it came from.

## The problem with try/catch

`try/catch` is an imperative construct. It tells the runtime: "try this thing, and if it blows up, deal with the mess." But it has three fundamental flaws:

**It doesn't compose.** You can't take the result of a try/catch and pass it to another function without nesting more try/catch blocks.

**It's not typed.** The `catch` receives `unknown`. TypeScript can't tell you what went wrong. You might get a network error, malformed JSON, or `undefined is not a function` — all in the same block.

**It's invisible.** If a function can fail but doesn't use try/catch, the compiler won't warn you. The error simply explodes at runtime, maybe in production, maybe at 3 AM.

## Either: the container that doesn't lie

Functional programming solved this problem decades ago. In Haskell it's called `Either`, in Scala `Try`, in F# `Result`. The idea is the same: **a container that holds either a value or an error, and the type tells you explicitly**.

In my project, I implemented it like this:

```typescript
type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

Two functions to construct it:

```typescript
function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
```

And a function to chain operations that can fail — `andThen`:

```typescript
function andThen<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  return result.ok ? fn(result.value) : result;
}
```

`andThen` is where the pattern becomes powerful. The idea is simple: **if the previous result is an error, do nothing. If it's a value, apply the next function to it.**

Let's see it in action with a real case. A user submits a meditation session. The request body could be:

```json
{ "date": "2026-03-25", "duration_min": 10, "session_type": "anapana" }
```

But it could also be:

```json
{ "date": "hello", "duration_min": -5 }
```

Or broken text, not even JSON. Or an empty body. Or an array instead of an object. In production, **everything happens**. The question is: how do you handle every case without losing your mind?

With `andThen` you build a chain where each step validates a piece, and if one fails the chain stops:

```typescript
const result = andThen(
  parseJsonBody(request),           // Step 1: is it valid JSON?
  body => parseSessionInput(body)   // Step 2: are the fields correct?
);
```

What happens with different inputs?

**Scenario 1: the client sends text, not JSON.** `parseJsonBody` fails and returns:

```typescript
{ ok: false, error: "Invalid JSON" }
```

`andThen` sees the error and **does not execute** `parseSessionInput`. The final result is the first step's error, intact.

**Scenario 2: the JSON is valid but the date is wrong** — `{ "date": "hello" }`. `parseJsonBody` succeeds and returns `ok({date: "hello"})`. `andThen` sees the value, executes `parseSessionInput`, which returns:

```typescript
{ ok: false, error: "Valid date (YYYY-MM-DD) required" }
```

The error is specific: not "something went wrong", but exactly **what** went wrong.

**Scenario 3: everything correct** — `{ "date": "2026-03-25", "duration_min": 10 }`. Both steps succeed:

```typescript
{ ok: true, value: { date: "2026-03-25", duration_min: 10, session_type: null } }
```

Three different scenarios, all handled by the same two-line chain. No try/catch, no nested ifs. The error propagates on its own and carries the exact message of what went wrong.

You can keep adding steps. Each `andThen` is a checkpoint: if something already failed earlier, it skips everything else.

```typescript
const result = andThen(
  andThen(
    andThen(
      parseJsonBody(request),              // 1. Is it JSON?
      body => validateNotEmpty(body)       // 2. Is it non-empty?
    ),
    body => parseSessionInput(body)        // 3. Are fields valid?
  ),
  session => validateDateNotFuture(session) // 4. Is the date not in the future?
);
```

If step 1 fails, steps 2, 3, and 4 never execute. If step 3 fails, step 4 doesn't execute. The error from the first failing step arrives intact at the end. No information lost.

Of course, nesting `andThen` calls is ugly to read — we'll come back to that with `pipe`.

## How the code changes in practice

Let's see the full flow. Input validation for meditation becomes a pure function that returns a `Result`:

```typescript
function parseSessionInput(body: unknown): Result<SessionInput> {
  if (!body || typeof body !== "object")
    return err("Body must be an object");

  const { date, duration_min, session_type } = body as Record<string, unknown>;

  if (!isValidDate(date))
    return err("Valid date (YYYY-MM-DD) required");

  return ok({
    date,
    duration_min: clampInt(duration_min, 0, 480, 0),
    session_type: typeof session_type === "string"
      ? session_type.slice(0, 200)
      : null,
  });
}
```

And the endpoint that uses it:

```typescript
export const POST: APIRoute = async ({ request }) => {
  if (!isAuthorized(request)) return jsonErr("Unauthorized", 401);

  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.ok) return jsonErr(bodyResult.error, 400);

  const parsed = parseSessionInput(bodyResult.value);
  if (!parsed.ok) return jsonErr(parsed.error, 400);

  const { date, duration_min, session_type } = parsed.value;
  // ... insert into DB
  return jsonOk({ ok: true, id: Number(result.lastInsertRowid) }, 201);
};
```

No try/catch. No `new Response(JSON.stringify(...))`. Every step is explicit: if it fails, the type tells you what went wrong. If you forget to check `.ok`, TypeScript won't let you access `.value`.

Look at how many unhappy paths are handled in these few lines:

1. **Missing or wrong token** → `jsonErr("Unauthorized", 401)` — stops immediately
2. **Body isn't valid JSON** (text, binary, empty) → `jsonErr("Invalid JSON", 400)`
3. **Body is JSON but not an object** → `jsonErr("Body must be an object", 400)`
4. **Date missing or wrong format** → `jsonErr("Valid date required", 400)`
5. **Duration negative, NaN, or string** → `clampInt` silently normalizes to 0
6. **session_type too long** (attack?) → truncated to 200 characters

Six error cases. Zero try/catch. Each case produces a clear message and an appropriate status code. And the compiler forces you to check them all — if you remove the `if (!parsed.ok)` check, TypeScript won't let you access `parsed.value`.

## The helpers: small functions, big impact

Alongside `Result` I built a small toolbox. Each function does one thing and does it well.

### Uniform JSON responses

Before, every endpoint constructed its `Response` by hand. Now:

```typescript
function jsonOk(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function jsonErr(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
```

Every endpoint responds with `return jsonOk(data)` or `return jsonErr("reason", 400)`. The format is always the same. If tomorrow I want to add a CORS header to all responses, I change it in one place.

### From Result to Response in one step

When you have a `Result` and want to transform it directly into an HTTP response:

```typescript
function resultToResponse<T>(result: Result<T>, successStatus = 200): Response {
  return result.ok
    ? jsonOk(result.value, successStatus)
    : jsonErr(result.error, 400);
}
```

This function is the bridge between the functional world (Result) and the HTTP world (Response). The logic knows nothing about HTTP, the endpoint knows nothing about validation. Each does its own job.

### Safe body parsing

`request.json()` can throw an exception if the body isn't valid JSON. It's one of those sneaky cases: the client sends a body with `Content-Type: application/json` but the content is `"hello world"`, or it's empty, or it's XML. Without protection, the endpoint blows up with an unhandled exception and the client gets a generic 500 with no idea what they did wrong.

Instead of writing a try/catch in every endpoint:

```typescript
function parseJsonBody(request: Request): Promise<Result<unknown>> {
  return request
    .json()
    .then((body: unknown) => ok(body))
    .catch(() => err("Invalid JSON"));
}
```

One line in the endpoint: `const bodyResult = await parseJsonBody(request)`. If the JSON is malformed, you get a `Result` with the error — not an exception you need to catch. The client gets a 400 with `{"error": "Invalid JSON"}` and knows exactly what went wrong.

### Reusable type guards

Validation repeats: dates, emails, non-empty strings, numbers in a range. Instead of rewriting regexes everywhere:

```typescript
function isValidDate(d: unknown): d is string {
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function isNonEmptyString(val: unknown): val is string {
  return typeof val === "string" && val.trim().length > 0;
}

function isValidEmail(val: unknown): val is string {
  return typeof val === "string" && val.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  if (val === null || val === undefined) return fallback;
  const n = typeof val === "number" ? val : Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}
```

Note the `d is string` return type: it's a **type guard**. After calling `isValidDate(date)`, TypeScript knows that `date` is a string. No cast needed.

`clampInt` is particularly useful: it accepts `unknown`, handles null, undefined, strings, NaN, and always returns an integer in range. No endpoint needs to worry about "what if the client sends a string instead of a number?"

These helpers seem trivial. But that's exactly the point: each function is so simple it can't have bugs. Complexity only arises from composition — and composition is explicit, readable, testable.

## Pipe: reading code like a sentence

The second concept is simpler but equally powerful. Let's start with a concrete example.

Say you want to transform a username: trim whitespace, lowercase it, and take the first 20 characters. Without pipe:

```typescript
const result = truncate(toLowerCase(trim(username)), 20);
```

You read inside-out: first `trim`, then `toLowerCase`, then `truncate`. But your eyes read left-to-right and see `truncate` first. You have to mentally reconstruct the order.

With `pipe`:

```typescript
const result = pipe(
  username,
  trim,
  toLowerCase,
  s => truncate(s, 20)
);
```

It reads top to bottom, in execution order:
1. Take `username`
2. Trim whitespace
3. Lowercase
4. Truncate to 20 characters

Each line is a step. Data flows downward like water.

### With Result it becomes even clearer

Where `pipe` truly shines is with `Result` and `andThen`. Take a complete endpoint — my site's contact form:

```typescript
// Without pipe: nesting and inverted reading order
const response = resultToResponse(
  andThen(
    andThen(
      await parseJsonBody(request),
      validateOrigin
    ),
    parseContactInput
  )
);

// With pipe: linear flow, reads like a story
const response = pipe(
  await parseJsonBody(request),           // 1. Read the JSON body
  body => andThen(body, validateOrigin),  // 2. Validate origin
  body => andThen(body, parseContactInput), // 3. Validate fields
  result => resultToResponse(result)       // 4. Transform to Response
);
```

If the JSON is malformed, step 1 returns `err("Invalid JSON")`. Steps 2, 3, and 4 don't execute — `andThen` propagates the error. If the origin isn't valid, it stops at step 2. And so on.

It's like an assembly line: if a part is defective, the line stops there. It doesn't reach the end with a hidden error inside.

### The implementation

The incredible thing is how simple the code is that makes all this work:

```typescript
function pipe(value: unknown, ...fns: Array<(arg: any) => any>): unknown {
  return fns.reduce((acc, fn) => fn(acc), value);
}
```

A `reduce`. One line. Take an initial value, apply the first function, pass the result to the second, and so on. JavaScript's `reduce` is already `pipe` — it just needed a name.

The rest is TypeScript overloads to preserve types through the chain:

```typescript
function pipe<A, B>(a: A, ab: (a: A) => B): B;
function pipe<A, B, C>(a: A, ab: (a: A) => B, bc: (b: B) => C): C;
function pipe<A, B, C, D>(
  a: A, ab: (a: A) => B, bc: (b: B) => C, cd: (c: C) => D
): D;
```

Each overload adds a step. TypeScript infers the type at every stage: if `ab` returns a `string`, then `bc` receives a `string`. If you get the type wrong, the compiler tells you before the code runs.

## The role of AI in all of this

I have to be honest: most of the code you see in this article was generated by an AI. I work with Claude Code as an always-available pair programmer. I give it a spec, we discuss the approach, it generates the code, I review and iterate.

But the choice to use `Result` instead of try/catch? That was mine. The decision to extract validation logic into pure, testable functions? Mine. The structure of the specs in `docs/` that guide the generation? Mine.

The specs are the real artifact of my work. In the repository there are files like `docs/meditation-spec.md` and `docs/comments-spec.md` that describe what each component should do, what the constraints are, how the parts should interact. The code is an implementation of the specs — and that implementation can be done by the AI, another developer, or me in six months.

Here's a real excerpt from `docs/meditation-spec.md`:

```markdown
## API Endpoints

### POST `/api/admin/meditation`

| Aspect         | Detail                                                                  |
|----------------|-------------------------------------------------------------------------|
| Auth           | Bearer token                                                            |
| Request body   | `{ date: "YYYY-MM-DD", duration_min?: number, session_type?: string }` |
| Validation     | `date` required, must match `/^\d{4}-\d{2}-\d{2}$/`                   |
| Logic          | INSERT into table with `created_at = datetime('now')`                  |
| Response 201   | `{ ok: true, id: <number> }`                                           |
| Response 400   | `{ error: "Valid date (YYYY-MM-DD) required" }`                        |
| Response 401   | `"Unauthorized"`                                                        |

## Trade-offs

- **Single-user**: the system is designed for one user only. No multi-user support
- **DELETE not exposed in UI**: the DELETE endpoint exists in the API but there's no button
  in the UI to delete sessions
- **365 quotes hardcoded**: quotes live in a static JS file, not the database.
  Adding or changing them requires a deploy
- **No push notifications**: no reminders to meditate. Motivation comes from
  the streak, not from phone interruptions
```

This table — with exact API contracts, response bodies, error codes — is the document I wrote. From this, the AI generated the endpoint you saw in the previous sections. The six unhappy paths that are handled? All documented here, before a single line of code existed.

The trade-offs are equally important: understanding what the system **doesn't** do is part of the design. "No push notifications" isn't a missing feature — it's a conscious choice. Motivation comes from the streak, not from your phone nagging you.

This changes the craft. I don't write less code — I write more specifications, more tests, more documented architectural decisions. Code has become the least important artifact of the project.

## The uncomfortable question

And here I arrive at the point I can't resolve.

Look at my project structure:

- **`src/lib/result.ts`** — zero Astro dependencies. Pure TypeScript. Works anywhere.
- **`src/lib/meditation.ts`** — zero Astro dependencies. Pure logic, tested with 73 test cases.
- **`src/pages/api/admin/meditation.ts`** — 77 lines of glue between Astro and my pure libraries.

The business logic is framework-agnostic. The framework is just the shell: routing, SSR, deploying to Netlify. If Astro disappeared tomorrow, I'd rewrite 77 lines of glue for SvelteKit or Hono. The logic would stay identical.

But then the question becomes a different one: if my code is already made of pure functions and small composable components, and the AI generates the glue — **why not use the web platform directly?**

HTML already has Custom Elements. The browser already has `<template>`, Shadow DOM, slots. They're standards, they don't change every six months, they don't require a bundler. A `<meditation-timer duration="10">` is a component. A `<result-handler>` that wraps a fetch and handles loading/error/success is a component. No framework, no virtual DOM, no build chain.

The pattern is the same as the server code: pure functions for logic, native HTML components for UI, composition instead of frameworks. The browser is already the framework.

I'm not saying it's the right answer. Astro gives me the content layer, file-based routing, SSG, adapters for Netlify — useful, concrete things. But when I look at the code I've written, the part that truly matters — the logic, the patterns, the decisions — doesn't depend on any of them.

And if my job is writing specifications and architectural decisions, and the implementation is generated by an AI that can reimplement them on any platform... the framework has become the clothes you change without touching the body. Or maybe it's the body itself that's changing shape.

I don't have an answer. But the question feels like the right one to ask.
