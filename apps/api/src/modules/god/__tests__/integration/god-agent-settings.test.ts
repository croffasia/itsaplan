import { describe, it, expect, beforeEach } from 'bun:test';
import { resetDb } from '#tests/helpers/db';
import { addUser, setup } from '../helpers';

// The instance-wide agent settings under god mode: what applies to every team's
// agents. Today that is how long the traces of their runs are kept, which the
// worker's sweep reads (agents/core/runtime/trace-retention.ts).

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
});
