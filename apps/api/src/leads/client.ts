import postgres, { type TransactionSql } from 'postgres';
import { HttpError } from '../shared/lib';

export type LeadsTransaction = TransactionSql<Record<string, never>>;

let client: ReturnType<typeof postgres> | null = null;

function leadsClient() {
  const url = process.env.VEXOL_LEADS_DATABASE_URL;
  if (!url) throw new HttpError(503, 'Leads data source is not configured');
  client ??= postgres(url, {
    max: 4,
    connect_timeout: 10,
    idle_timeout: 20,
    prepare: false,
    ssl: process.env.NODE_ENV === 'test' ? false : 'require',
    connection: {
      application_name: 'itsaplan-leads-readonly',
      default_transaction_read_only: true,
      statement_timeout: 8000,
    },
  });
  return client;
}

export async function withLeadsRead<T>(read: (sql: LeadsTransaction) => Promise<T>): Promise<T> {
  try {
    return (await leadsClient().begin('read only', read)) as unknown as T;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (process.env.NODE_ENV === 'test') throw error;
    throw new HttpError(503, 'Leads data is temporarily unavailable');
  }
}
