import { t } from 'elysia';

// A calendar day, as the `date` columns hold it.
export const isoDate = (description: string) =>
  t.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$', format: 'date', description });

// A query bound on a timestamptz column, parsed with instantParam.
export const instantQuery = (description: string) =>
  t.Optional(t.String({ description: `${description} ISO timestamp or YYYY-MM-DD.` }));
