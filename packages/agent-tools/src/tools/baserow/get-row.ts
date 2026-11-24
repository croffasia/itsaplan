import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { baserowRequest, idRef, tableInput, type BaserowRow } from './client';

export const baserowGetRow: CustomToolEntry = {
  key: 'baserow_get_row',
  group: 'Rows',
  label: 'Baserow Get Row',
  scopes: ['Read'],
  description: 'Read one row of a Baserow table.',
  inputSchema: z.object({
    table: tableInput,
    row: z.union([z.number(), z.string()]).describe('Row id, or the row URL.'),
  }),
  execute: async (credential, input) =>
    baserowRequest<BaserowRow>(
      credential,
      'GET',
      `database/rows/table/${idRef(input.table, 'table')}/${idRef(input.row, 'row')}/?user_field_names=true`,
    ),
};
