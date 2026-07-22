import { Elysia, t } from 'elysia';

// One recorded request as returned over HTTP (the in-memory Received entry).
const ReceivedResponse = t.Object({
  at: t.String(),
  method: t.String(),
  headers: t.Record(t.String(), t.String()),
  body: t.Any(),
});

// Test receiver for webhooks — a dev aid, not part of the product API. Register
// its URL as a webhook to see exactly what the delivery worker sends:
//   POST   /webhook-test/sink   records the request and echoes it back
//   GET    /webhook-test/sink   lists the most recent requests it received
//   DELETE /webhook-test/sink   clears the log
// Unauthenticated (a webhook sender carries no session). Stored in memory only,
// bounded to the last MAX requests. Remove this route once real testing is done.

interface Received {
  at: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

const MAX = 50;
const log: Received[] = [];

export const webhookTestRoutes = new Elysia({
  name: 'webhook-test',
  detail: { tags: ['Webhook test'] },
})
  .post(
    '/webhook-test/sink',
    ({ request, body }) => {
      const entry: Received = {
        at: new Date().toISOString(),
        method: request.method,
        headers: Object.fromEntries(request.headers),
        body: body ?? null,
      };
      log.unshift(entry);
      if (log.length > MAX) log.length = MAX;
      // Echo back what arrived (the worker sees this as the delivery response).
      return { received: entry };
    },
    {
      response: { 200: t.Object({ received: ReceivedResponse }) },
      detail: {
        summary: 'Receive a test webhook',
        description: 'Receive a webhook and echo what arrived',
      },
    },
  )
  .get('/webhook-test/sink', () => ({ count: log.length, requests: log }), {
    response: { 200: t.Object({ count: t.Number(), requests: t.Array(ReceivedResponse) }) },
    detail: {
      summary: 'List test webhook deliveries',
      description: 'List the received webhook requests',
    },
  })
  .delete(
    '/webhook-test/sink',
    () => {
      log.length = 0;
      return { cleared: true };
    },
    {
      response: { 200: t.Object({ cleared: t.Boolean() }) },
      detail: {
        summary: 'Clear test webhook deliveries',
        description: 'Clear the received webhook log',
      },
    },
  );
