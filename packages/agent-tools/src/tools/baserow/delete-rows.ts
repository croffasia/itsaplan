import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { baserowRequest, idRef, tableInput } from './client';

export const baserowDeleteRows: CustomToolEntry = {
  key: 'baserow_delete_rows',
  group: 'Rows',
  label: 'Baserow Delete Rows',
  scopes: ['Delete'],
  description:
    'Delete rows from a Baserow table. Deleted rows go to the Baserow trash, where a person can restore them.',
  inputSchema: z.object({
    table: tableInput,
    ids: z
      .array(z.number().int())
      .min(1)
      .max(200)
      .describe('Ids of the rows to delete, up to 200.'),
  }),
  execute: async (credential, input) => {
    const ids = input.ids as number[];
    await baserowRequest(
      credential,
      'POST',
      `database/rows/table/${idRef(input.table, 'table')}/batch-delete/`,
      { items: ids },
    );
    return { deleted: ids };
  },
};
