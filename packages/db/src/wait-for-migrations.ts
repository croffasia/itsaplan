// Init container of the worker and bot pods in the Helm chart: exits once the database
// holds every migration of this release. The api pods' migrate init container applies
// them; this one only waits, so the dump stays with the api pods.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set — cannot check migrations.');
}

const journal: { entries: { when: number }[] } = JSON.parse(
  readFileSync(fileURLToPath(new URL('../drizzle/meta/_journal.json', import.meta.url)), 'utf8'),
);
const latest = Math.max(...journal.entries.map((e) => e.when));

const sql = postgres(connectionString, { max: 1 });
const RETRY_DELAY_MS = 3000;

// A refused connection and a missing drizzle table both read as "not yet".
for (;;) {
  const [applied] = await sql<{ last: string | null }[]>`
    select max(created_at)::text as last from drizzle.__drizzle_migrations
  `.catch(() => [{ last: null }]);
  if (applied?.last && Number(applied.last) >= latest) break;
  console.log('⏳ Waiting for the database migrations to be applied...');
  await Bun.sleep(RETRY_DELAY_MS);
}

await sql.end();
console.log('✅ Database is migrated');
