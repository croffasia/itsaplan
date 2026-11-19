import { describe, it, expect, beforeEach } from 'bun:test';
import { resetDb } from '#tests/helpers/db';
import { addUser, setup } from '../helpers';

describe('god API key settings', () => {
  beforeEach(resetDb);

  it('refuses both routes for a user who is not the instance owner', async () => {
    await setup();
    const outsider = await addUser();

    expect((await outsider.api.god['api-key-settings'].get()).status).toBe(403);
    expect((await outsider.api.god['api-key-settings'].put({ requestsPerMinute: 5 })).status).toBe(
      403,
    );
  });

  it('starts at 1200 requests a minute, and stores a change', async () => {
    const { god } = await setup();
    expect((await god.api.god['api-key-settings'].get()).data).toEqual({
      requestsPerMinute: 1200,
    });

    const put = await god.api.god['api-key-settings'].put({ requestsPerMinute: 100_000 });

    expect(put.status).toBe(200);
    expect((await god.api.god['api-key-settings'].get()).data).toEqual({
      requestsPerMinute: 100_000,
    });
  });

  it('refuses a limit that is negative, fractional or over the maximum', async () => {
    const { god } = await setup();

    for (const requestsPerMinute of [-1, 1.5, 100_001]) {
      const put = await god.api.god['api-key-settings'].put({ requestsPerMinute });
      expect(put.status).toBe(400);
    }
  });
});
