import { Elysia, t } from 'elysia';
import { checkCompetitor } from './check';
import { listDueCompetitors, pruneCompetitorEvents } from './store';

// Internal endpoint the worker calls to run one sweep of the accounts that are due
// a check. The reading needs the project's integration credentials, which are
// encrypted at rest and only decryptable here, so the work runs in the API and the
// worker only owns the schedule — the same split as
// /internal/notification-deliveries/send.
const sweepBody = t.Object({
  intervalMs: t.Number({ minimum: 60_000 }),
  batchSize: t.Number({ minimum: 1, maximum: 100 }),
  retainDays: t.Optional(t.Number({ minimum: 1, maximum: 365 })),
});

export const internalCompetitorRoutes = new Elysia({ name: 'internal-competitors' }).post(
  '/internal/competitors/sweep',
  async ({ body, headers, set }) => {
    const expected = process.env.WORKER_INTERNAL_TOKEN;
    if (!expected || headers['x-worker-token'] !== expected) {
      set.status = 401;
      return { checked: 0, failed: 0, events: 0, pruned: 0, error: 'Unauthorized' };
    }

    const due = await listDueCompetitors(body.intervalMs, body.batchSize);
    let failed = 0;
    let events = 0;
    for (const account of due) {
      const result = await checkCompetitor(account);
      if (result.ok) events += result.events;
      else failed += 1;
    }
    const pruned = body.retainDays ? await pruneCompetitorEvents(body.retainDays) : 0;
    return { checked: due.length, failed, events, pruned };
  },
  { body: sweepBody },
);
