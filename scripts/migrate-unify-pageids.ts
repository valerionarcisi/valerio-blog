import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";

const envFile = readFileSync(".env", "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const APPLY = process.argv.includes("--apply");

async function main() {
  const conflicts = await client.execute(`
    SELECT
      REPLACE(REPLACE(post_id, 'it/', ''), 'en/', '') AS slug,
      visitor_hash,
      COUNT(*) AS dup_rows
    FROM post_claps
    GROUP BY slug, visitor_hash
    HAVING COUNT(*) > 1
  `);
  if (conflicts.rows.length > 0) {
    console.error("ABORT: post_claps conflicts would occur after strip:");
    for (const r of conflicts.rows) console.error(r);
    process.exit(1);
  }

  const beforeComments = await client.execute(
    `SELECT id, page_id FROM comments WHERE page_id LIKE 'it/%' OR page_id LIKE 'en/%'`
  );
  const beforeClaps = await client.execute(
    `SELECT id, post_id FROM post_claps WHERE post_id LIKE 'it/%' OR post_id LIKE 'en/%'`
  );

  console.log(`\ncomments rows to update: ${beforeComments.rows.length}`);
  for (const r of beforeComments.rows) console.log(`  ${r.id}\t${r.page_id}`);
  console.log(`\npost_claps rows to update: ${beforeClaps.rows.length}`);
  for (const r of beforeClaps.rows) console.log(`  ${r.id}\t${r.post_id}`);

  if (!APPLY) {
    console.log("\n(dry-run) re-run with --apply to execute");
    return;
  }

  console.log("\napplying...");

  await client.batch([
    {
      sql: `UPDATE comments
            SET page_id = SUBSTR(page_id, 4)
            WHERE page_id LIKE 'it/%' OR page_id LIKE 'en/%'`,
      args: [],
    },
    {
      sql: `UPDATE post_claps
            SET post_id = SUBSTR(post_id, 4)
            WHERE post_id LIKE 'it/%' OR post_id LIKE 'en/%'`,
      args: [],
    },
  ]);

  const afterC = await client.execute(
    `SELECT page_id, COUNT(*) AS n FROM comments GROUP BY page_id ORDER BY page_id`
  );
  const afterP = await client.execute(
    `SELECT post_id, COUNT(*) AS n FROM post_claps GROUP BY post_id ORDER BY post_id`
  );
  console.log("\n=== comments after ===");
  for (const r of afterC.rows) console.log(`  ${r.n}\t${r.page_id}`);
  console.log("\n=== post_claps after ===");
  for (const r of afterP.rows) console.log(`  ${r.n}\t${r.post_id}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
