import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

const none = { assigned: false, mentioned: false, commented: false, state_changed: false };
const all = { assigned: true, mentioned: true, commented: true, state_changed: true };

async function projectApi() {
  const user = await signUpTestUser();
  const api = authedApi(user.cookie);
  await createProject(api, { key: 'MKT', name: 'Marketing' });
  return { prefs: api.projects({ projectKey: 'MKT' })['notification-preferences'] };
}

describe('notification preferences', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('accepts a request without appriseEvents and defaults Apprise to off', async () => {
    const { prefs } = await projectApi();

    const res = await prefs.put({ emailEvents: all, telegramEvents: none });

    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({
      emailEvents: all,
      telegramEvents: none,
      appriseEvents: none,
    });
  });

  it('keeps the stored Apprise toggles when a request omits them', async () => {
    const { prefs } = await projectApi();
    await prefs.put({ emailEvents: none, telegramEvents: none, appriseEvents: all });

    const res = await prefs.put({ emailEvents: all, telegramEvents: all });

    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ emailEvents: all, telegramEvents: all, appriseEvents: all });
    expect((await prefs.get()).data?.appriseEvents).toEqual(all);
  });

  it('replaces the Apprise toggles when a request sends them', async () => {
    const { prefs } = await projectApi();
    await prefs.put({ emailEvents: none, telegramEvents: none, appriseEvents: all });

    const res = await prefs.put({ emailEvents: none, telegramEvents: none, appriseEvents: none });

    expect(res.data?.appriseEvents).toEqual(none);
  });
});
