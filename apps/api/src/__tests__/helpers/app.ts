import { treaty } from '@elysiajs/eden';
import { app } from '../../app';

// Anonymous Eden Treaty client bound to the in-memory app (no network, no port).
// Use for unauthenticated routes; planner routes return 401 through this.
export const api = treaty(app);

// Treaty client that sends a session cookie on every request. Pass the `cookie`
// from signUpTestUser to act as that user.
export function authedApi(cookie: string) {
  return treaty(app, { headers: { cookie } });
}

export type Api = typeof api;
