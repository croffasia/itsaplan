import { t } from 'elysia';

export const revQuery = t.Object({
  scopes: t.String({
    description:
      "Comma-separated scopes to read, each '<kind>:<id>' — board, issue, initiative, or documents, agentRuns or inbox (by project id), or a kind an extension adds — plus 'inbox:all' for the inbox of every readable project and 'runnerQueue:1'.",
  }),
});

export const RevResponse = t.Object({ revs: t.Record(t.String(), t.String()) });
