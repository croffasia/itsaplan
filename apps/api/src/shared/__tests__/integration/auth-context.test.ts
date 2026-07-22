import { describe, it, expect, beforeEach } from 'bun:test';
import { api, authedApi } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';

// The session gate. authContext reads the better-auth session, puts `user` on
// the context, and throws 401 when there is none — every planner route runs
// behind it. This is the one place the gate is tested; feature tests assume it
// and do not re-check the no-session case. /projects is used as a representative
// guarded route. The public exception (GET /attachments/:publicId/raw skips the
// gate) is covered by the attachments feature.
describe('auth-context (session gate)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('rejects a request with no session', async () => {
    const res = await api.projects.get();
    expect(res.status).toBe(401);
  });

  it('rejects a request with an invalid session cookie', async () => {
    const res = await authedApi('better-auth.session_token=not-a-real-token').projects.get();
    expect(res.status).toBe(401);
  });

  it('resolves the session and lets an authenticated request through', async () => {
    const user = await signUpTestUser();
    const res = await authedApi(user.cookie).projects.get();
    expect(res.status).toBe(200);
  });
});
