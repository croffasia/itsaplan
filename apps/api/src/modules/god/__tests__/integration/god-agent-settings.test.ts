import { describe, it, expect, beforeEach } from 'bun:test';
import { resetDb } from '#tests/helpers/db';
import { addUser, setup } from '../helpers';

// The instance-wide agent settings under god mode: what applies to every team's
// agents: how long the traces of their runs are kept, which the background sweep reads
// (agents/core/runtime/trace-retention.ts), the longest one run may take, and how many
// runs are in flight at once.

describe('god agent settings', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('refuses both routes for a user who is not the instance owner', async () => {
    await setup();
    const outsider = await addUser();

    expect((await outsider.api.god['agent-settings'].get()).status).toBe(403);
    expect((await outsider.api.god['agent-settings'].put({ traceRetentionDays: 7 })).status).toBe(
      403,
    );
  });

  it('starts at 30 days', async () => {
    const { god } = await setup();

    const res = await god.api.god['agent-settings'].get();

    expect(res.status).toBe(200);
    expect(res.data?.traceRetentionDays).toBe(30);
  });

  it('stores a change and reads it back', async () => {
    const { god } = await setup();

    const put = await god.api.god['agent-settings'].put({ traceRetentionDays: 7 });
    const get = await god.api.god['agent-settings'].get();

    expect(put.status).toBe(200);
    expect(get.data?.traceRetentionDays).toBe(7);
  });

  it('takes 0, which keeps every trace', async () => {
    const { god } = await setup();

    const res = await god.api.god['agent-settings'].put({ traceRetentionDays: 0 });

    expect(res.status).toBe(200);
    expect(res.data?.traceRetentionDays).toBe(0);
  });

  it('refuses a negative window and one past ten years', async () => {
    const { god } = await setup();

    expect((await god.api.god['agent-settings'].put({ traceRetentionDays: -1 })).status).toBe(400);
    expect((await god.api.god['agent-settings'].put({ traceRetentionDays: 3651 })).status).toBe(
      400,
    );
  });

  it('starts the run time maximum at 240 seconds', async () => {
    const { god } = await setup();

    const res = await god.api.god['agent-settings'].get();

    expect(res.data?.maxRunSeconds).toBe(240);
  });

  it('keeps a run time maximum taken from the environment within range', async () => {
    const { god } = await setup();
    process.env.AGENT_RUN_TIMEOUT_MS = '7200000';
    try {
      const res = await god.api.god['agent-settings'].get();

      expect(res.status).toBe(200);
      expect(res.data?.maxRunSeconds).toBe(3600);
    } finally {
      delete process.env.AGENT_RUN_TIMEOUT_MS;
    }
  });

  it('changes one setting without touching the other', async () => {
    const { god } = await setup();

    await god.api.god['agent-settings'].put({ traceRetentionDays: 7 });
    const res = await god.api.god['agent-settings'].put({ maxRunSeconds: 900 });

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ traceRetentionDays: 7, maxRunSeconds: 900, maxConcurrentRuns: 5 });
  });

  it('refuses a run time maximum under 10 seconds or over an hour', async () => {
    const { god } = await setup();

    expect((await god.api.god['agent-settings'].put({ maxRunSeconds: 9 })).status).toBe(400);
    expect((await god.api.god['agent-settings'].put({ maxRunSeconds: 3601 })).status).toBe(400);
  });

  it('starts at 5 runs at once and takes 0, which sets no limit', async () => {
    const { god } = await setup();

    expect((await god.api.god['agent-settings'].get()).data?.maxConcurrentRuns).toBe(5);
    const res = await god.api.god['agent-settings'].put({ maxConcurrentRuns: 0 });

    expect(res.status).toBe(200);
    expect(res.data?.maxConcurrentRuns).toBe(0);
  });

  it('refuses a negative run limit and one over 1000', async () => {
    const { god } = await setup();

    expect((await god.api.god['agent-settings'].put({ maxConcurrentRuns: -1 })).status).toBe(400);
    expect((await god.api.god['agent-settings'].put({ maxConcurrentRuns: 1001 })).status).toBe(400);
  });
});
