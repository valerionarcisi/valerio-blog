---
title: "The Real Parameter: Why Iterating Matters More Than Writing Code"
date: "2026-03-04"
extract: "I built a self-hosted analytics system using Claude. But the interesting part isn't the code — it's the iterative process that turned an idea into a working product in just a few hours."
tags: ["ai", "javascript", "thoughts", "analytics"]
coverImage: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=1200&h=630&fit=crop"
coverAuthorName: "Lisa Keffer"
coverAuthorLink: "https://unsplash.com/@lisakeffer"
---

A few weeks ago I decided to replicate a piece of software I use every day — Simple Analytics — from scratch, with Claude. Not because I needed to. I did it because I wanted to answer a question that's been nagging me for a while: **how long does it take me to replicate a SaaS product with an AI?**

Behind that question lies an uncomfortable one: if I can do it in a few hours, what's the point for many software products to keep existing? What's the point, by extension, of a personal blog like this one?

The answer surprised me. But not in the way I expected.

## The right fear

We're living in a moment where a single developer with an LLM can replicate in hours what used to take weeks and a team. This isn't theoretical — I just did it. In a few hours I had a complete analytics system: data collection endpoint, Turso database, dashboard with charts, scroll depth, time on page, visitor tracking. All privacy-first, zero cookies, self-hosted.

If it's that easy, many software products no longer have a reason to exist in their current form. That's a legitimate fear, and I believe it's the right fear to have.

But in doing it, I understood something else.

## It's not the code, it's the path

The first version worked. Then I compared the numbers with Simple Analytics: 170 visitors on their end, 29 on mine. Same period, same site.

Instead of rewriting everything, I asked "why?" And a cycle began that I could never have planned:

Ad blockers were blocking my endpoint because it was called `/api/collect` — too obvious. The Do Not Track check was dropping real users to comply with a dead specification. Client-side deduplication was imprecise. No retry on lost data. The rate limiter reset on every serverless cold start.

Five problems, found one after the other, each revealing the next. It wasn't a plan — it was a continuous **ping-pong** between me and Claude. I asked questions, he proposed solutions, I evaluated, he adjusted. Back and forth until the system actually worked.

Then the Chinese visitors appeared. All Chrome, all Windows, all desktop. Zero scroll, zero time on page. Bots, obviously. Claude suggested filtering them with static rules — country, user agent, known patterns. It worked, but it was fragile. So I asked him to build a trap instead: invisible links that a real user would never see, but that a bot follows automatically. From there, a honeypot system with behavioral detection was born — something that wasn't in any original plan.

**I didn't write almost any of those lines of code.** But the system works because I knew what to ask, when to push back, and when to change direction.

## The bot trap

A honeypot, in cybersecurity, is a trap. Something that looks appealing to an attacker but actually serves only to identify them. In our case: invisible links in the footer that a real user will never see, but that a bot — which parses the DOM looking for URLs — follows without hesitation.

Here's how the conversation went.

**Me:** *"how about doing something like a honeypot. An invisible link that the bot goes looking for and sees as normal. Could that be the right approach?"*

Claude generated an endpoint `/api/t` — a deliberately opaque name — and a hidden link in the footer. Then I asked him to reinforce the trap.

**Me:** *"let's reinforce the trap first"*

And he multiplied the baits, using three different CSS techniques to hide them, with text that bots love:

```html
<a href="/api/t"
   style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;"
   tabindex="-1" aria-hidden="true">sitemap</a>

<a href="/api/t?r=2"
   style="clip:rect(0,0,0,0);position:absolute;width:1px;height:1px;"
   tabindex="-1" aria-hidden="true">wp-admin</a>

<a href="/api/t?r=3"
   style="opacity:0;pointer-events:none;position:absolute;"
   tabindex="-1" aria-hidden="true">login</a>
```

"sitemap", "wp-admin", "login" — words that a crawler follows by instinct. A real user never sees them. `aria-hidden="true"` and `tabindex="-1"` hide them from screen readers and keyboard navigation too.

When a bot follows one of these links, the endpoint computes a visitor hash and saves it to a `bot_hashes` table:

```typescript
export const GET: APIRoute = async ({ request }) => {
  const ua = request.headers.get("user-agent") ?? undefined;
  if (isBot(ua)) return new Response(null, { status: 204 });

  const ip = request.headers.get("x-forwarded-for")
    ?.split(",")[0]?.trim() ?? "unknown";

  const hash = await generateVisitorHash("valerionarcisi.me", ip, ua ?? "");
  await db.execute({
    sql: "INSERT OR IGNORE INTO bot_hashes (hash) VALUES (?)",
    args: [hash],
  });

  return new Response(null, { status: 204 });
};
```

From that moment on, all stats queries automatically exclude those visitors. No false positives, no static rules to maintain. The bot identifies itself.

What struck me? I would never have planned this solution. It was born from a question asked at the right moment, during a conversation that was heading in a different direction.

## The abstraction has shifted

The abstraction used to be the programming language. Assembly was too close to the machine, then C came along, then high-level languages, then frameworks. Each layer moved us away from the machine and closer to the problem.

Now the abstraction is the conversation. Claude, agents, LLMs — they're the new layer through which we talk to machines. You no longer write `for (let i = 0; i < arr.length; i++)`. You say "filter the bots from the stats and show me only real visitors". Natural language has become the programming language.

And if language is no longer the bottleneck, then writing code no longer holds the value it once did. Period. I'm not saying you don't need to understand what happens under the hood — you absolutely do. But the ability to write correct syntax on the first try is no longer a skill worth anything.

## The software that will disappear

If language is no longer the bottleneck, then the amount of code that will be replicated is going to be massive. A few internal developers with an LLM are enough, and most of the software we currently outsource — to external consultants, body rental, agencies — can be rewritten in-house in ridiculous timeframes. Too much for certain business models to survive.

Perhaps only very vertical products will endure — those with particular domains where accumulated knowledge has a value that can't be replicated with a prompt. But for everything else? The countdown has already started.

And then there's the UX question. Today the flow is: search on Google → open a site → navigate a list → find what you need. But if an agent can do all of that for me, what's the point of the portal? Maybe for 90% of SaaS products, all you'll need is an MCP server and a client that talks to it. The agent does the work, the portal only serves for truly advanced features — the ones that require a complex interface, a visualization that a prompt can't deliver.

It's just a personal thought, obviously. But the fact that I'm asking myself this while building an analytics system with an AI... well, that seems quite telling.

## The whiteboard test

Now picture yourself in a job interview. There's a person watching you write pseudo code on a whiteboard. No internet. They ask you to reverse a binary tree, or implement a merge sort from memory.

Does that make sense?

In my opinion, it didn't make sense even before. Measuring memory, in our field, has never made sense — not in school, not at university, not in interviews. I understand it's an easy parameter to measure, and I understand why it was adopted. But easy to measure doesn't mean meaningful.

Now, it makes no sense at all. An LLM has access to memory so vast we can't even come close to matching it. Asking you to remember a function signature is like asking you to do multiplication by hand when you have a calculator in front of you. You can do it, but why should you?

## So what actually matters?

What matters is **what** you're doing, **why** you're doing it, and **the path** you take to get there.

In my case: I chose to replicate a product to understand something about AI, I discovered the value lies in the iterative process, I changed direction multiple times following the data instead of the plan. Every solved problem opened another I couldn't have predicted. The honeypot for Chinese bots wasn't in any brief — it was born from the right question asked at the right moment.

Maybe one day they'll ask us for the list of prompts we use to reach a result. Maybe. But even that would be just an imperfect proxy.

Because the truth is you can't measure proactivity in a one-hour interview. You can't measure creativity with a test. You can't understand whether someone knows how to iterate by asking them to write code on a whiteboard.

Creativity — the real kind, the kind that makes you ask the question nobody thought to ask — comes from the creative activities you pursue in your free time. From the films you watch, the music you listen to, the problems you invent and solve out of curiosity. It's unproductive by definition, and that's precisely why it's the focal point.

## The next step

I replicated Simple Analytics in a few hours. I built a bot detection system I hadn't planned. I added SEO, hreflang, RSS autodiscovery, an `llms.txt` file to make the site discoverable by AI.

The next step? Maybe I'll rewrite this site in WebAssembly. Or directly in assembly. Why not?

If language is no longer the constraint, then the question is no longer "what do I write it in" but "what do I want it to do and why". And that's a question no one has ever been able to answer for you. Not even before.
