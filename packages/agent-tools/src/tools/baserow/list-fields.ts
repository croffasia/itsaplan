import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { baserowRequest, idRef, tableInput } from './client';

interface BaserowField {
  id: number;
  name: string;
  type: string;
  primary?: boolean;
  read_only?: boolean;
  description?: string | null;
  select_options?: { id: number; value: string }[];
  link_row_table_id?: number;
}

export const baserowListFields: CustomToolEntry = {
  key: 'baserow_list_fields',
  group: 'Tables',
  label: 'Baserow List Fields',
  scopes: ['Read'],
  description: 'List the fields of a Baserow table.',
  inputSchema: z.object({ table: tableInput }),
  execute: async (credential, input) => {
    const fields = await baserowRequest<BaserowField[]>(
      credential,
      'GET',
      `database/fields/table/${idRef(input.table, 'table')}/`,
    );
    return {
      fields: fields.map((f) => ({
        name: f.name,
        type: f.type,
        primary: f.primary ?? false,
        readOnly: f.read_only ?? false,
        ...(f.description ? { description: f.description } : {}),
        ...(f.select_options
          ? { options: f.select_options.map((o) => ({ id: o.id, name: o.value })) }
          : {}),
        ...(f.link_row_table_id ? { linkedTableId: f.link_row_table_id } : {}),
      })),
    };
  },
};
