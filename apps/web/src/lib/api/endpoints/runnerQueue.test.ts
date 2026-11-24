import assert from 'node:assert/strict';
import { it } from 'node:test';
import { getRunnerQueue } from './runnerQueue';

it('sends queue pagination as a single query string', async () => {
  const original = globalThis.fetch;
  let requested = '';
  globalThis.fetch = (async (input) => {
    requested = String(input);
    return Response.json({ items: [], total: 0, page: 2, pageSize: 10, queued: 0, running: 0 });
  }) as typeof fetch;
  try {
    await getRunnerQueue('/projects/team.RUN', { page: 2, pageSize: 10 });
    const url = new URL(requested);
    assert.equal(url.pathname, '/projects/team.RUN/agent-runs/queue');
    assert.equal(url.searchParams.get('page'), '2');
    assert.equal(url.searchParams.get('pageSize'), '10');
    assert.equal(url.searchParams.has('?page'), false);
  } finally {
    globalThis.fetch = original;
  }
});
