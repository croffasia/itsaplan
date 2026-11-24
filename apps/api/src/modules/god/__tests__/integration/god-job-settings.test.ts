import { describe, it, expect, beforeEach } from 'bun:test';
import { defaultJobSettings } from '@repo/db';
import { resetDb } from '#tests/helpers/db';
import { addUser, setup } from '../helpers';

// The background job settings under god mode: poll intervals, batch sizes, leases and
// attempts that the api, the worker and the bot read on every pass.

describe('god job settings', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('refuses both routes for a user who is not the instance owner', async () => {
    await setup();
    const outsider = await addUser();

    expect((await outsider.api.god['job-settings'].get()).status).toBe(403);
    expect(
      (await outsider.api.god['job-settings'].put({ webhooks: { maxAttempts: 3 } })).status,
    ).toBe(403);
  });

  it('starts at the defaults', async () => {
    const { god } = await setup();

    const res = await god.api.god['job-settings'].get();

    expect(res.status).toBe(200);
    expect(res.data).toEqual(defaultJobSettings());
  });

  it('changes the fields sent and keeps every other one', async () => {
    const { god } = await setup();

    await god.api.god['job-settings'].put({ agentRuns: { maxAttempts: 5 } });
    const put = await god.api.god['job-settings'].put({ webhooks: { batchSize: 50 } });
    const get = await god.api.god['job-settings'].get();

    const expected = defaultJobSettings();
    expected.agentRuns.maxAttempts = 5;
    expected.webhooks.batchSize = 50;
    expect(put.status).toBe(200);
    expect(get.data).toEqual(expected);
  });

  it('takes a claim wait up to 30 seconds, under the runner request timeout', async () => {
    const { god } = await setup();

    const max = await god.api.god['job-settings'].put({ agentChat: { claimWaitMs: 30_000 } });
    const over = await god.api.god['job-settings'].put({ agentChat: { claimWaitMs: 30_001 } });

    expect(max.status).toBe(200);
    expect(over.status).toBe(400);
  });

  it('refuses a value under its minimum', async () => {
    const { god } = await setup();

    expect((await god.api.god['job-settings'].put({ webhooks: { maxAttempts: 0 } })).status).toBe(
      400,
    );
    expect(
      (await god.api.god['job-settings'].put({ imports: { pollIntervalMs: 99 } })).status,
    ).toBe(400);
  });

  it('refuses a webhook lease that is not longer than the webhook timeout', async () => {
    const { god } = await setup();

    const equal = await god.api.god['job-settings'].put({
      webhooks: { timeoutMs: 20_000, leaseSeconds: 20 },
    });
    const longer = await god.api.god['job-settings'].put({
      webhooks: { timeoutMs: 20_000, leaseSeconds: 21 },
    });

    expect(equal.status).toBe(400);
    expect(longer.status).toBe(200);
  });

  it('refuses an invocation timeout the run or chat lease does not outlast', async () => {
    const { god } = await setup();

    const chat = await god.api.god['job-settings'].put({ agentChat: { leaseSeconds: 15 } });
    const run = await god.api.god['job-settings'].put({
      agentInvocations: { timeoutMs: 60_000 },
      agentRuns: { leaseSeconds: 60 },
    });
    const get = await god.api.god['job-settings'].get();

    expect(chat.status).toBe(400);
    expect(run.status).toBe(400);
    expect(get.data).toEqual(defaultJobSettings());
  });
});
