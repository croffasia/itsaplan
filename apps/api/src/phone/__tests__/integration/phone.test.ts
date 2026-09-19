import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { api, authedApi } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';

// The routes read from Rinkel over the network, so what is covered here is the
// wiring this app owns: access control, input validation, and the answer given
// when no API key is configured. Reaching Rinkel itself is not exercised.

async function setupProject() {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  return { asOwner };
}

describe('Business number', () => {
  const originalKey = process.env.RINKEL_KEY;

  beforeEach(async () => {
    await resetDb();
    delete process.env.RINKEL_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.RINKEL_KEY;
    else process.env.RINKEL_KEY = originalKey;
  });

  it('reports that the instance has no key instead of failing', async () => {
    const { asOwner } = await setupProject();

    const overview = await asOwner.projects({ projectKey: 'MKT' }).phone.overview.get();
    expect(overview.status).toBe(200);
    expect(overview.data).toMatchObject({ configured: false, numbers: [], newVoicemails: 0 });
  });

  it('refuses to list calls without a key rather than calling out', async () => {
    const { asOwner } = await setupProject();

    const calls = await asOwner.projects({ projectKey: 'MKT' }).phone.calls.get({ query: {} });
    expect(calls.status).toBe(503);
  });

  it('rejects a direction and a page the API does not accept', async () => {
    const { asOwner } = await setupProject();

    const badDirection = await asOwner
      .projects({ projectKey: 'MKT' })
      .phone.calls.get({ query: { direction: 'sideways' as 'inbound' } });
    expect(badDirection.status).toBe(400);

    const badPage = await asOwner
      .projects({ projectKey: 'MKT' })
      .phone.calls.get({ query: { page: 0 } });
    expect(badPage.status).toBe(400);
  });

  it('keeps a non-member out', async () => {
    await setupProject();
    const outsider = await signUpTestUser();

    const overview = await authedApi(outsider.cookie)
      .projects({ projectKey: 'MKT' })
      .phone.overview.get();
    expect(overview.status).toBe(403);
  });

  it('needs a session', async () => {
    await setupProject();
    const overview = await api.projects({ projectKey: 'MKT' }).phone.overview.get();
    expect(overview.status).toBe(401);
  });
});

const TOKEN = 'test-webhook-token';

function post(token: string, body: unknown) {
  return api.phone.webhook({ token }).post(body as { event: string });
}

describe('Phone webhook', () => {
  const originalToken = process.env.PHONE_WEBHOOK_TOKEN;

  beforeEach(async () => {
    await resetDb();
    process.env.PHONE_WEBHOOK_TOKEN = TOKEN;
  });

  afterEach(() => {
    if (originalToken === undefined) delete process.env.PHONE_WEBHOOK_TOKEN;
    else process.env.PHONE_WEBHOOK_TOKEN = originalToken;
  });

  it('accepts an event and hands it to the dashboard', async () => {
    const { asOwner } = await setupProject();

    const delivered = await post(TOKEN, {
      event: 'incomingCall',
      payload: {
        callId: 'call-1',
        direction: 'inbound',
        externalNumber: { localized: '06 39429209', e164: '+31639429209' },
        internalNumber: { number: '+31852501911' },
      },
    });
    expect(delivered.status).toBe(204);

    const events = await asOwner.projects({ projectKey: 'MKT' }).phone.events.get({ query: {} });
    expect(events.status).toBe(200);
    expect(events.data).toHaveLength(1);
    expect(events.data![0]).toMatchObject({
      event: 'incomingCall',
      callId: 'call-1',
      direction: 'inbound',
      externalNumber: '06 39429209',
      internalNumber: '+31852501911',
    });
  });

  it('stores an event whose payload carries nothing it knows', async () => {
    const { asOwner } = await setupProject();

    expect((await post(TOKEN, { event: 'callInsights' })).status).toBe(204);

    const events = await asOwner.projects({ projectKey: 'MKT' }).phone.events.get({ query: {} });
    expect(events.data![0]).toMatchObject({
      event: 'callInsights',
      callId: null,
      externalNumber: null,
    });
  });

  it('refuses a wrong token', async () => {
    const refused = await post('not-the-token', { event: 'incomingCall' });
    expect(refused.status).toBe(404);
  });

  it('refuses everything when no token is configured', async () => {
    delete process.env.PHONE_WEBHOOK_TOKEN;
    const refused = await post(TOKEN, { event: 'incomingCall' });
    expect(refused.status).toBe(404);
  });

  it('returns only the events after the one the dashboard last saw', async () => {
    const { asOwner } = await setupProject();
    await post(TOKEN, { event: 'incomingCall', payload: { callId: 'first' } });
    await post(TOKEN, { event: 'incomingCall', payload: { callId: 'second' } });

    const all = await asOwner.projects({ projectKey: 'MKT' }).phone.events.get({ query: {} });
    expect(all.data).toHaveLength(2);

    const firstId = all.data![0].id;
    const rest = await asOwner
      .projects({ projectKey: 'MKT' })
      .phone.events.get({ query: { since: firstId } });
    expect(rest.data).toHaveLength(1);
    expect(rest.data![0]).toMatchObject({ callId: 'second' });
  });

  it('keeps the event list behind the session', async () => {
    await setupProject();
    const anonymous = await api.projects({ projectKey: 'MKT' }).phone.events.get({ query: {} });
    expect(anonymous.status).toBe(401);
  });
});
