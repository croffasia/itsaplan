// Programmatic migration runner — used on api container startup
// (drizzle-kit is not needed in production, only the generated SQL in ./drizzle).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import {
  pendingMigrations,
  pruneBackups,
  recordBackup,
  recordMigrationRun,
  writeBackup,
} from './backup';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set — cannot run migrations.');
}

const migrationClient = postgres(connectionString, { max: 1 });
const db = drizzle(migrationClient);

const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));

// Compose orders the api behind a healthy postgres, but a platform without that
// guarantee (Railway, plain `docker run`) starts both at once and the first
// connections are refused. Wait for the server separately so a failing migration
// still reports on the first attempt.
const ATTEMPTS = 15;
const RETRY_DELAY_MS = 2000;

for (let attempt = 1; ; attempt++) {
  try {
    await migrationClient`select 1`;
    break;
  } catch (error) {
    if (attempt === ATTEMPTS) throw error;
    console.log(`⏳ Waiting for the database (${attempt}/${ATTEMPTS})...`);
    await Bun.sleep(RETRY_DELAY_MS);
  }
}

// A dump of the database as this release found it, so an operator who has to go back
// to the previous release has something to restore. Taken before anything is applied,
// and a failure stops the startup: a migration that runs without one cannot be undone.
// SKIP_PRE_MIGRATION_BACKUP=1 is for an operator who backs up by other means, and is
// what `db:migrate:test` sets — BACKUP_DIR is a path only the api container has, and
// a test database that is truncated between tests has nothing to go back to.
const journal = JSON.parse(readFileSync(`${migrationsFolder}/meta/_journal.json`, 'utf8'));
const pending = await pendingMigrations(migrationClient, journal);
const skipBackup = process.env.SKIP_PRE_MIGRATION_BACKUP === '1';
let backup = null;

if (pending.length > 0 && !skipBackup) {
  console.log(`⏳ Backing up the database before ${pending.length} migration(s)...`);
  try {
    backup = await writeBackup(pending);
  } catch (error) {
    console.error(
      `❌ The backup failed, so no migration was applied: ${error instanceof Error ? error.message : String(error)}\n` +
        '   Fix the backup, or set SKIP_PRE_MIGRATION_BACKUP=1 to upgrade without one.',
    );
    throw error;
  }
  console.log(`✅ Backup written to ${backup.path} (${Math.round(backup.sizeBytes / 1024)} KB)`);
}

console.log('⏳ Running migrations...');
await migrate(db, { migrationsFolder });
if (pending.length > 0) await recordMigrationRun(migrationClient, pending);
if (backup) await recordBackup(migrationClient, backup);
const removed = await pruneBackups();
if (removed > 0) console.log(`🧹 Removed ${removed} backup(s) past the retention window`);
await migrationClient.end();
console.log('✅ Migrations applied');
