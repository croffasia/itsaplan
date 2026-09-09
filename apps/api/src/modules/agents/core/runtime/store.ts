import { PostgresStore } from '@mastra/pg';
import { db } from '@repo/db';
import { sql } from 'drizzle-orm';

// The Postgres store Mastra keeps its own tables in, on the application database.
// Two things write to it: conversation memory (threads and messages, see memory.ts)
// and the traces of agent runs (see observability.ts).

let store: PostgresStore | null = null;

export function getStore(): PostgresStore {
  if (!store) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is required for the agent store');
    store = new PostgresStore({ id: 'ai-agent-memory', connectionString: url });
  }
  return store;
}

// Mastra creates its tables on first use, so an instance whose agents have never run
// has none of them yet. Everything that reads the spans directly checks this first.
export async function spansTableExists(): Promise<boolean> {
  const rows = await db.execute<{ exists: boolean }>(
    sql`SELECT to_regclass('public.mastra_ai_spans') IS NOT NULL AS exists`,
  );
  return rows[0]?.exists === true;
}
