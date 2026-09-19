import { beforeEach, describe, expect, it } from 'bun:test';
import { authedApi } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';

async function setupProject() {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'OPS', name: 'Operations' });
  return { asOwner };
}

describe('Calendar', () => {
  beforeEach(async () => {
    await resetDb();
  }, 30_000);

  it('reports no connection before an account is linked', async () => {
    const { asOwner } = await setupProject();

    const response = await asOwner.projects({ projectKey: 'OPS' }).calendar.connection.get();
    expect(response.status).toBe(200);
    expect(response.data).toMatchObject({
      connected: false,
      accountEmail: null,
      hiddenCalendarIds: [],
      lastError: null,
    });
    // The test instance has no Google OAuth client, so connecting is not offered.
    expect(response.data!.instanceReady).toBe(false);
    expect(response.data!.redirectUri).toContain('/calendar/google/callback');
  });

  it('refuses to start a connection while the instance has no Google client', async () => {
    const { asOwner } = await setupProject();

    const response = await asOwner.projects({ projectKey: 'OPS' }).calendar.connect.post();
    expect(response.status).toBe(409);
  });

  it('answers with 409, not an empty calendar, when nothing is connected', async () => {
    const { asOwner } = await setupProject();

    const calendars = await asOwner.projects({ projectKey: 'OPS' }).calendar.calendars.get();
    expect(calendars.status).toBe(409);

    const events = await asOwner
      .projects({ projectKey: 'OPS' })
      .calendar.events.get({ query: { from: '2026-01-01T00:00:00Z', to: '2026-01-08T00:00:00Z' } });
    expect(events.status).toBe(409);
  });

  it('keeps every route behind the calendar permission', async () => {
    await setupProject();
    const outsider = await signUpTestUser();
    const asOutsider = authedApi(outsider.cookie);

    const connection = await asOutsider.projects({ projectKey: 'OPS' }).calendar.connection.get();
    expect(connection.status).toBe(403);

    const connect = await asOutsider.projects({ projectKey: 'OPS' }).calendar.connect.post();
    expect(connect.status).toBe(403);

    const events = await asOutsider
      .projects({ projectKey: 'OPS' })
      .calendar.events.get({ query: { from: '2026-01-01T00:00:00Z', to: '2026-01-08T00:00:00Z' } });
    expect(events.status).toBe(403);

    const created = await asOutsider.projects({ projectKey: 'OPS' }).calendar.events.post({
      calendarId: 'primary',
      title: 'Not mine',
      description: null,
      location: null,
      start: '2026-01-02T10:00:00Z',
      end: '2026-01-02T11:00:00Z',
      allDay: false,
    });
    expect(created.status).toBe(403);
  });

  it('rejects an event that ends before it starts', async () => {
    const { asOwner } = await setupProject();

    const response = await asOwner.projects({ projectKey: 'OPS' }).calendar.events.post({
      calendarId: 'primary',
      title: 'Backwards',
      description: null,
      location: null,
      start: '2026-01-02T12:00:00Z',
      end: '2026-01-02T09:00:00Z',
      allDay: false,
    });
    // The window is checked before the connection is read, so this never reaches Google.
    expect(response.status).toBe(400);
  });
});
