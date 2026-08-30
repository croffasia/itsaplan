import { beforeEach, describe, expect, it } from 'bun:test';
import { resetDb } from '#tests/helpers/db';
import { addUser, setup } from '../helpers';

describe('god email settings', () => {
  beforeEach(resetDb);

  it('refuses a test from a plain user', async () => {
    await setup();
    const user = await addUser({ email: 'member@example.com' });

    const res = await user.api.god['email-settings'].test.post();

    expect(res.status).toBe(403);
  });

  it('refuses a test until a provider is configured', async () => {
    const { god } = await setup();

    const res = await god.api.god['email-settings'].test.post();

    expect(res.status).toBe(400);
    expect(res.error!.value).toMatchObject({ error: 'Configure an email provider first' });
  });
});
