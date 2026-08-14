import { treaty } from '@elysiajs/eden';
import { app } from '../../app';

// Anonymous Eden Treaty client bound to the in-memory app (no network, no port).
// Use for unauthenticated routes; planner routes return 401 through this.
export const api = treaty(app);

// Treaty client that sends a session cookie on every request. Pass additional
// headers when the route behavior depends on request metadata.
export function authedApi(cookie: string, headers?: Record<string, string>) {
  return treaty(app, { headers: { ...headers, cookie } });
}

export type Api = typeof api;
