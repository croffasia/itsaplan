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

console.log('⏳ Running migrations...');
await migrate(db, { migrationsFolder });
await migrationClient.end();
console.log('✅ Migrations applied');
