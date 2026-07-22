import { db } from '@repo/db';
import { sql } from 'drizzle-orm';

// TRUNCATEs every table in the test database so each test starts clean. Two
// guards keep this from ever running against a real database: NODE_ENV must be
// "test" and DATABASE_URL must name a database containing "test". Call it in a
// beforeEach (or beforeAll) in every integration test that touches the DB.
export async function resetDb(): Promise<void> {
  const url = process.env.DATABASE_URL ?? '';
  const dbName = url.split('/').pop()?.split('?')[0] ?? '';
  if (process.env.NODE_ENV !== 'test' || !dbName.includes('test')) {
    throw new Error(
      `resetDb refused: expected NODE_ENV=test and a DATABASE_URL whose database name contains "test", got NODE_ENV=${process.env.NODE_ENV} db=${dbName}. Use .env.test.`,
    );
  }

  // All application and better-auth tables live in the public schema. The
  // drizzle migrations bookkeeping table is excluded so migrations are not
  // re-run. RESTART IDENTITY resets serial ids; CASCADE handles FK order.
  const rows = (await db.execute(sql`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '__drizzle_migrations'
  `)) as unknown as Array<{ tablename: string }>;

  const tables = rows.map((r) => `"${r.tablename}"`).join(', ');
  if (tables.length === 0) return;
  await db.execute(sql.raw(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`));
}
