import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { baserowRequest, idRef, rowValues, tableInput, type BaserowRow } from './client';

export const baserowCreateRows: CustomToolEntry = {
  key: 'baserow_create_rows',
  group: 'Rows',
  label: 'Baserow Create Rows',
  scopes: ['Create'],
  description: 'Create rows in a Baserow table.',
  inputSchema: z.object({
    table: tableInput,
    rows: z.array(rowValues).min(1).max(200).describe('The rows to create, up to 200.'),
  }),
  execute: async (credential, input) => {
    const body = await baserowRequest<{ items: BaserowRow[] }>(
      credential,
      'POST',
      `database/rows/table/${idRef(input.table, 'table')}/batch/?user_field_names=true`,
      { items: input.rows },
    );
    return { rows: body.items };
  },
};
