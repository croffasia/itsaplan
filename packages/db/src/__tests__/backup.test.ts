import { afterAll, expect, it } from 'bun:test';
import postgres from 'postgres';
import { pendingMigrations } from '../backup';

// Runs against the migrated test database, whose core table holds rows.
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
afterAll(() => sql.end());

it('counts every migration of a build whose table does not exist yet as pending', async () => {
  const journal = {
    entries: [
      { when: 2, tag: '0001_b' },
      { when: 1, tag: '0000_a' },
    ],
  };
  expect(await pendingMigrations(sql, journal)).toEqual([]);
  expect(await pendingMigrations(sql, journal, '__missing_migrations')).toEqual([
    '0000_a',
    '0001_b',
  ]);
});
