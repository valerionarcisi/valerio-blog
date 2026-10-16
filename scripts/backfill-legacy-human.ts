import { createClient } from "@libsql/client";
import { rollupRange } from "../src/lib/analytics-rollup";
import {
  backfillLegacyHuman,
  detectCutover,
  parseCutover,
} from "../src/lib/analytics-legacy-human";

// One-off: mark the pageviews recorded BEFORE the engage signal existed as human (the old counting rule),
// so the dashboard and the weekly report do not show ~0 users for the days before the deploy.
//
// DRY RUN by default (reads only, prints what it would do):
//   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npx -y tsx scripts/backfill-legacy-human.ts --auto
//   ... --before 2026-10-15T14:46:00        (UTC; use this to choose the cutover yourself)
// Then apply (writes, and recomputes the daily rollups of the affected days):
//   ... --auto --apply
// --auto uses the time of the first real engage signal as the cutover. Safe to re-run.

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error("TURSO_DATABASE_URL is not set");
  process.exit(1);
}
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

let host = url;
try {
  host = new URL(url).host || url;
} catch {
  /* file: URLs have no host */
}
console.log(`Database: ${host}`);

let before: string;
const explicit = arg("before");
if (explicit) {
  before = parseCutover(explicit);
} else if (has("auto")) {
  const first = await detectCutover(db);
  if (!first) {
    console.error(
      "No pageview with a human signal yet: the new tracker has not recorded any engage. " +
        "Nothing to cut over. Run again after the first real visits, or pass --before.",
    );
    process.exit(1);
  }
  before = first;
  console.log(`Cutover (first engage signal): ${before} UTC`);
} else {
  console.error("Usage: backfill-legacy-human.ts (--auto | --before <UTC timestamp>) [--apply]");
  process.exit(1);
}

const apply = has("apply");
const plan = await backfillLegacyHuman(db, { before, apply });

console.log(`\nCutover: ${plan.before} UTC`);
console.log(`Pageviews to mark human: ${plan.rows}`);
console.log(`Older rows left as they are (look like bots): ${plan.keptAsBot}`);
for (const d of plan.perDay) console.log(`  ${d.day}: ${d.rows}`);

if (!apply) {
  console.log("\nDRY RUN: nothing was changed. Add --apply to write.");
} else if (plan.rows === 0) {
  console.log("\nNothing to do.");
} else {
  console.log(`\nUpdated ${plan.updated} rows.`);
  // Only closed days: today is read live, and the nightly job recomputes yesterday anyway.
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const lastClosed = plan.lastDay && plan.lastDay < yesterday ? plan.lastDay : yesterday;
  if (plan.firstDay && plan.firstDay <= lastClosed) {
    const res = await rollupRange(db, plan.firstDay, lastClosed);
    console.log(`Rollups recomputed for ${res.length} days (${plan.firstDay} -> ${lastClosed}).`);
  }
}
db.close();
