// Programmatic migration runner — used on api container startup
// (drizzle-kit is not needed in production, only the generated SQL in ./drizzle).
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set — cannot run migrations.');
}

const migrationClient = postgres(connectionString, { max: 1 });
const db = drizzle(migrationClient);

const migrationsFolder = new URL('../drizzle', import.meta.url).pathname;

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

console.log('⏳ Running migrations...');
await migrate(db, { migrationsFolder });
await migrationClient.end();
console.log('✅ Migrations applied');
