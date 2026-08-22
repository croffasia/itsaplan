import { t } from 'elysia';

export const revQuery = t.Object({
  scopes: t.String({
    description:
      "Comma-separated scopes to read, each '<kind>:<id>' — board, issue, initiative, or inbox (by project id).",
  }),
});

export const RevResponse = t.Object({ revs: t.Record(t.String(), t.String()) });
