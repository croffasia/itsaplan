import { t } from 'elysia';

export const revQuery = t.Object({
  scopes: t.String({
    description:
      "Comma-separated scopes to read, each '<kind>:<id>' — board, issue, initiative, documents, or inbox (by project id) — plus 'inbox:all' for the inbox of every readable project and 'runnerQueue:1'.",
  }),
});

export const RevResponse = t.Object({ revs: t.Record(t.String(), t.String()) });
