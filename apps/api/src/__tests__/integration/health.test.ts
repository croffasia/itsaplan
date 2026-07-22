import { describe, it, expect } from 'bun:test';
import { api } from '../helpers/app';

// Smoke test for the Eden Treaty setup. These routes need no session and no
// database, so this file passes even when Postgres is down — if it fails, the
// treaty/app wiring is broken, not the DB.
describe('health', () => {
  it('GET / returns the liveness payload', async () => {
    const { data, status } = await api.get();

    expect(status).toBe(200);
    expect(data).toEqual({ name: "It's a Plan api", status: 'ok' });
  });

  it('GET /me without a session reports unauthenticated', async () => {
    const { data, status } = await api.me.get();

    expect(status).toBe(200);
    expect(data).toEqual({ authenticated: false });
  });

  it('GET /projects without a session is rejected with 401', async () => {
    const { error } = await api.projects.get();

    expect(error?.status).toBe(401);
  });
});
