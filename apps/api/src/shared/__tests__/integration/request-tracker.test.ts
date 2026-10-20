import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { app, authedApi } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';
import { setRequestTracker, type TrackedAnswer, type TrackedRequest } from '../../request-tracker';

interface Seen {
  request: Omit<TrackedRequest, 'request'> & { method: string };
  answer?: Omit<TrackedAnswer, 'user'> & { userId: string | null };
}

// Follows every request to a team route and records what the tracker was handed.
function trackTeams(): Seen[] {
  const seen: Seen[] = [];
  setRequestTracker(async ({ request, route, params, body }) => {
    if (!route.startsWith('/teams')) return undefined;
    const entry: Seen = { request: { method: request.method, route, params, body } };
    seen.push(entry);
    return async ({ status, user, value }) => {
      entry.answer = { status, value, userId: user?.id ?? null };
    };
  });
  return seen;
}

describe('request tracker', () => {
  beforeEach(resetDb);
  afterEach(() => setRequestTracker());

  it('hands over the route, its params and body, then the answer and who asked', async () => {
    const owner = await signUpTestUser();
    const seen = trackTeams();
    const created = await authedApi(owner.cookie).teams.post({
      name: 'Marketing',
      slug: 'marketing',
      workspaceId: owner.workspaceId!,
    });
    expect(created.status).toBe(201);
    const teamId = created.data!.id;
    await authedApi(owner.cookie).teams({ teamId }).delete();

    expect(seen).toMatchObject([
      {
        request: { method: 'POST', route: '/teams', body: { name: 'Marketing' } },
        answer: { status: 201, userId: owner.userId, value: { id: teamId, name: 'Marketing' } },
      },
      {
        request: { method: 'DELETE', route: '/teams/:teamId', params: { teamId } },
        answer: { status: 204, userId: owner.userId, value: undefined },
      },
    ]);
  });

  it('hands over the status of a request a guard refuses, and who asked', async () => {
    const owner = await signUpTestUser();
    const stranger = await signUpTestUser();
    const teamId = (await authedApi(owner.cookie).teams.get()).data![0].id;
    const seen = trackTeams();
    const res = await authedApi(stranger.cookie).teams({ teamId }).delete();
    expect(res.status).toBe(404);
    expect(res.error?.value).toEqual({ error: 'Team not found' });
    expect(seen).toMatchObject([
      { answer: { status: 404, userId: stranger.userId, value: undefined } },
    ]);
  });

  it('does not fail the request when the tracker throws', async () => {
    const owner = await signUpTestUser();
    const teamId = (await authedApi(owner.cookie).teams.get()).data![0].id;
    setRequestTracker(async () => async () => {
      throw new Error('tracker failed');
    });
    const res = await authedApi(owner.cookie)
      .teams({ teamId })
      .patch({ name: 'Renamed', slug: 'renamed' });
    expect(res.status).toBe(200);
    expect(res.data?.name).toBe('Renamed');
  });

  it('leaves the body to a route that reads the raw request', async () => {
    const owner = await signUpTestUser({ password: 'test-password-123' });
    let body: unknown = 'not handed over';
    setRequestTracker(async (request) => {
      if (request.route === '/api/auth/*') body = request.body;
      return undefined;
    });
    const res = await app.handle(
      new Request('http://localhost/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: owner.email, password: 'test-password-123' }),
      }),
    );
    expect(res.status).toBe(200);
    expect(body).toBeUndefined();
  });
});
