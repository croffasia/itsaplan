import { db, defaultMemberPermissions, teamRole } from '@repo/db';
import { sql } from 'drizzle-orm';

// Empties every table in the test database so each test starts clean. Two
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
  // re-run, and so is the MCP resource better-auth writes once, at startup.
  // DELETE is much cheaper than TRUNCATE on the many small tables a test leaves
  // behind: TRUNCATE rewrites every relation file. The replica role skips FK
  // checks and triggers, so no delete order is needed and the revision triggers
  // do not fire; it needs a superuser, as the test Postgres is. The sequences of
  // the cleared tables restart, as RESTART IDENTITY did. One DO block is one
  // round trip and one transaction, which SET LOCAL is scoped to.
  await db.execute(sql`
    DO $$
    DECLARE t text;
    BEGIN
      SET LOCAL session_replication_role = replica;
      FOR t IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename NOT IN ('__drizzle_migrations', 'oauth_resource')
      LOOP
        EXECUTE format('DELETE FROM public.%I', t);
      END LOOP;
      PERFORM setval(d.objid, s.seqstart, false)
      FROM pg_depend d
      JOIN pg_sequence s ON s.seqrelid = d.objid
      JOIN pg_class c ON c.oid = d.refobjid
      WHERE d.classid = 'pg_class'::regclass AND d.refclassid = 'pg_class'::regclass
        AND d.deptype IN ('a', 'i') AND c.relnamespace = 'public'::regnamespace
        AND c.relname NOT IN ('__drizzle_migrations', 'oauth_resource');
    END $$
  `);
  // Migration 0160 seeds the default system role; every member without a chosen role
  // joins on it.
  await db
    .insert(teamRole)
    .values({ name: 'Member', isDefault: true, permissions: defaultMemberPermissions() });
}
