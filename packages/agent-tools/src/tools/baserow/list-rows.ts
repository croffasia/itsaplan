import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { baserowRequest, fieldList, idRef, tableInput, type BaserowRow } from './client';

export const baserowListRows: CustomToolEntry = {
  key: 'baserow_list_rows',
  group: 'Rows',
  label: 'Baserow List Rows',
  scopes: ['Read'],
  description: 'List rows of a Baserow table.',
  inputSchema: z.object({
    table: tableInput,
    search: z.string().optional().describe('Return only rows whose cells match this text.'),
    filters: z
      .array(
        z.object({
          field: z.string().min(1).describe('Field name.'),
          type: z
            .string()
            .min(1)
            .describe(
              'Filter type, such as equal, not_equal, contains, contains_not, higher_than, lower_than, empty, not_empty, boolean, single_select_equal, link_row_has, date_is, date_is_before, date_is_after, date_is_on_or_before or date_is_on_or_after.',
            ),
          value: z
            .union([z.string(), z.number(), z.boolean()])
            .optional()
            .describe(
              'The value to compare with. For single_select_equal, the option id from baserow_list_fields; for link_row_has, the row id; for a date filter, the time zone, date and mode, such as "UTC?2026-01-31?exact_date". Leave out for empty and not_empty.',
            ),
        }),
      )
      .optional()
      .describe('Conditions on field values.'),
    filterType: z
      .enum(['AND', 'OR'])
      .optional()
      .describe('AND: a row matches every filter (default). OR: a row matches any filter.'),
    orderBy: z
      .array(z.string().min(1))
      .optional()
      .describe('Field names to sort by, in order. Prefix a name with - to sort descending.'),
    fields: z
      .array(z.string().min(1))
      .optional()
      .describe('Return only these fields. Leave out to return every field.'),
    viewId: z
      .number()
      .int()
      .optional()
      .describe(
        'Apply the filters and sorts of this view. In the URL /database/1/table/2/3, the view id is 3.',
      ),
    size: z
      .number()
      .int()
      .min(1)
      .max(200)
      .optional()
      .describe('How many rows to return per page, 1-200 (default 20).'),
    page: z.number().int().min(1).optional().describe('Page number (default 1).'),
  }),
  execute: async (credential, input) => {
    const page = Number(input.page ?? 1);
    const query = new URLSearchParams({
      user_field_names: 'true',
      page: String(page),
      size: String(input.size ?? 20),
    });
    if (input.search) query.set('search', String(input.search));
    const filters = input.filters as { field: string; type: string; value?: unknown }[] | undefined;
    if (filters?.length) {
      query.set(
        'filters',
        JSON.stringify({
          filter_type: input.filterType ?? 'AND',
          filters: filters.map((f) => ({
            field: f.field,
            type: f.type,
            value: f.value === undefined ? '' : String(f.value),
          })),
        }),
      );
    }
    const orderBy = input.orderBy as string[] | undefined;
    if (orderBy?.length) query.set('order_by', fieldList(orderBy));
    const fields = input.fields as string[] | undefined;
    if (fields?.length) query.set('include', fieldList(fields));
    if (input.viewId !== undefined) query.set('view_id', String(input.viewId));

    const body = await baserowRequest<{
      count: number;
      next: string | null;
      results: BaserowRow[];
    }>(credential, 'GET', `database/rows/table/${idRef(input.table, 'table')}/?${query}`);
    return { total: body.count, page, hasMore: Boolean(body.next), rows: body.results };
  },
};
