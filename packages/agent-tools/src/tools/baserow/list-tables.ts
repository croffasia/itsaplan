import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { baserowRequest } from './client';

export const baserowListTables: CustomToolEntry = {
  key: 'baserow_list_tables',
  group: 'Tables',
  label: 'Baserow List Tables',
  description: 'List the Baserow tables.',
  inputSchema: z.object({}),
  execute: async (credential) => {
    const tables = await baserowRequest<{ id: number; name: string; database_id: number }[]>(
      credential,
      'GET',
      'database/tables/all-tables/',
    );
    return {
      tables: tables.map((t) => ({ id: t.id, name: t.name, databaseId: t.database_id })),
    };
  },
};
