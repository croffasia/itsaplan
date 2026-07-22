import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Check your .env (see .env.example at the monorepo root).',
  );
}

// One connection per process. postgres-js manages the pool internally.
const queryClient = postgres(connectionString, { prepare: false });

export const db = drizzle(queryClient, { schema });
