// Database dump taken before migrations are applied, so an operator can restore the
// state a release upgraded from. Written by migrate.ts on api startup.
//
// It runs only when there is something to migrate and the database already holds
// data: a fresh instance has nothing to lose, and a restart that applies nothing
// would otherwise write a dump on every boot.
//
// A dump that fails stops the startup: applying this release's migrations without
// one leaves no way back.
import { mkdir, readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { Sql } from 'postgres';

export const BACKUP_DIR = process.env.BACKUP_DIR || '/backups';

// A value that is not a positive number falls back to the default rather than
// reaching the cutoff arithmetic: NaN days makes every dump read as expired, and the
// prune would delete the ones a downgrade needs.
const configuredRetention = Number(process.env.BACKUP_RETENTION_DAYS);
export const RETENTION_DAYS =
  Number.isFinite(configuredRetention) && configuredRetention > 0 ? configuredRetention : 30;

export interface BackupResult {
  path: string;
  sizeBytes: number;
  createdAt: string;
  expiresAt: string;
  // The migrations the dump was taken in front of, newest last.
  migrations: string[];
}

interface JournalEntry {
  when: number;
  tag: string;
}

const CORE_TABLE = '__drizzle_migrations';

// The newest row of a drizzle bookkeeping table, or null when the table is missing or
// empty.
async function lastApplied(sql: Sql, table: string): Promise<string | null> {
  const [found] = await sql<{ exists: boolean }[]>`
    select to_regclass(${`drizzle.${table}`}) is not null as exists
  `;
  if (!found?.exists) return null;
  const [applied] = await sql<{ last: string | null }[]>`
    select max(created_at)::text as last from drizzle.${sql(table)}
  `;
  return applied?.last ?? null;
}

// The migrations drizzle is about to apply: the journal entries newer than the last
// row of its own table, which is exactly what its migrator compares.
export async function pendingMigrations(
  sql: Sql,
  journal: { entries: JournalEntry[] },
  table = CORE_TABLE,
): Promise<string[]> {
  const core = await lastApplied(sql, CORE_TABLE);
  // No core table, or an empty one: the database is new and holds nothing to dump.
  if (core === null) return [];
  // A build's table that is missing or empty has every migration of the build ahead of it.
  const last = Number((table === CORE_TABLE ? core : await lastApplied(sql, table)) ?? 0);
  return journal.entries
    .filter((e) => e.when > last)
    .sort((a, b) => a.when - b.when)
    .map((e) => e.tag);
}

function stamp(date: Date): string {
  return date.toISOString().replace(/[:T]/g, '-').replace(/\..+$/, '');
}

// Runs pg_dump into BACKUP_DIR. Throws with pg_dump's own stderr when it fails, and
// when it writes an empty file — a truncated dump restores nothing.
export async function writeBackup(migrations: string[]): Promise<BackupResult> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set — cannot take a backup.');
  await mkdir(BACKUP_DIR, { recursive: true });
  const createdAt = new Date();
  const path = join(BACKUP_DIR, `itsaplan-${stamp(createdAt)}.dump`);

  // The password goes through PGPASSWORD rather than argv, where the process list would
  // show it for as long as the dump runs; a URI without one sets no variable, so an
  // ambient PGPASSWORD or .pgpass still applies. The rest of the URI is passed as it is,
  // so every other connection option (sslmode and the like) still reaches libpq.
  const dsn = new URL(url);
  const password = decodeURIComponent(dsn.password);
  dsn.password = '';

  const proc = Bun.spawn(
    ['pg_dump', '--format=custom', '--no-owner', '--no-privileges', '--file', path, dsn.toString()],
    {
      stdout: 'pipe',
      stderr: 'pipe',
      env: password ? { ...process.env, PGPASSWORD: password } : process.env,
    },
  );
  const stderr = await new Response(proc.stderr).text();
  const code = await proc.exited;
  // pg_dump creates the file before it writes, so a failed run leaves a partial one
  // behind. It is deleted here: a dump that restores nothing must not sit next to the
  // ones that do.
  const size = await stat(path).then(
    (s) => s.size,
    () => 0,
  );
  if (code !== 0 || size === 0) {
    await unlink(path).catch(() => {});
    throw new Error(
      code !== 0
        ? `pg_dump exited with ${code}: ${stderr.trim() || 'no output'}`
        : `pg_dump wrote an empty file to ${path}`,
    );
  }

  const expiresAt = new Date(createdAt.getTime() + RETENTION_DAYS * 86_400_000);
  return {
    path,
    sizeBytes: size,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    migrations,
  };
}

// Deletes dumps past the retention window. Runs on every startup, so a dump outlives
// its window until the api restarts. Failures are reported and ignored: a backup that
// cannot be cleaned up is not a reason to hold the release back.
export async function pruneBackups(): Promise<number> {
  const cutoff = Date.now() - RETENTION_DAYS * 86_400_000;
  let removed = 0;
  const names = await readdir(BACKUP_DIR).catch(() => [] as string[]);
  for (const name of names) {
    if (!name.startsWith('itsaplan-') || !name.endsWith('.dump')) continue;
    const path = join(BACKUP_DIR, name);
    try {
      const { mtimeMs } = await stat(path);
      if (mtimeMs >= cutoff) continue;
      await unlink(path);
      removed++;
    } catch (error) {
      console.warn(`⚠️  Could not remove the old backup ${path}: ${String(error)}`);
    }
  }
  return removed;
}

// Records which migrations this startup applied, so the "what changed" screen can tell
// a report of one upgrade from a report left by an earlier one. Written whether or not
// a dump was taken, and only when something was applied: a plain restart applies
// nothing and must not erase what the last upgrade did.
export async function recordMigrationRun(sql: Sql, migrations: string[]): Promise<void> {
  await sql`
    insert into app_setting (key, value, updated_at)
    values ('migration.last', ${JSON.stringify({ migrations })}::jsonb, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()
  `;
}

// Records the dump where the app can read it: the "what changed" screen tells the
// operator where it is and when it goes away. Written after the migrations, so
// app_setting is guaranteed to exist.
export async function recordBackup(sql: Sql, backup: BackupResult): Promise<void> {
  await sql`
    insert into app_setting (key, value, updated_at)
    values ('backup.last', ${JSON.stringify(backup)}::jsonb, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()
  `;
}
