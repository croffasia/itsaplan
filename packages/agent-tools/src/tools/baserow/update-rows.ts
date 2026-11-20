import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { baserowRequest, idRef, rowValues, tableInput, type BaserowRow } from './client';

export const baserowUpdateRows: CustomToolEntry = {
  key: 'baserow_update_rows',
  group: 'Rows',
  label: 'Baserow Update Rows',
  scopes: ['Update'],
  description: 'Update rows in a Baserow table.',
  inputSchema: z.object({
    table: tableInput,
    rows: z
      .array(
        z.object({
          id: z.number().int().describe('Row id.'),
          values: rowValues,
        }),
      )
      .min(1)
      .max(200)
      .describe(
        'The rows to update, up to 200. Fields left out of values keep their current values.',
      ),
  }),
  execute: async (credential, input) => {
    const rows = input.rows as { id: number; values: Record<string, unknown> }[];
    const body = await baserowRequest<{ items: BaserowRow[] }>(
      credential,
      'PATCH',
      `database/rows/table/${idRef(input.table, 'table')}/batch/?user_field_names=true`,
      { items: rows.map((row) => ({ ...row.values, id: row.id })) },
    );
    return { rows: body.items };
  },
};
