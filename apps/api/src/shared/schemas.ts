import { t } from 'elysia';

// Request schemas shared by more than one feature.

// A calendar day, as the `date` columns hold it. The caller passes what the date
// stands for on its route, which is what the OpenAPI docs and the MCP tools show.
export const isoDate = (description: string) =>
  t.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$', description });
