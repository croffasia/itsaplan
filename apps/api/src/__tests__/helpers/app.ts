import { treaty } from '@elysiajs/eden';
import { app, internalApp } from '../../app';

// The apps themselves, for a route Treaty cannot drive (an event stream, where there
// is no JSON body to hand back) and for the /internal/* routes, which live on the
// internal instance rather than the public one.
export { app, internalApp };

// Anonymous Eden Treaty client bound to the in-memory app (no network, no port).
// Use for unauthenticated routes; planner routes return 401 through this.
export const api = treaty(app);

// Treaty client that sends a session cookie on every request. Pass additional
// headers when the route behavior depends on request metadata.
export function authedApi(cookie: string, headers?: Record<string, string>) {
  return treaty(app, { headers: { ...headers, cookie } });
}

// Treaty client that authenticates with an API key instead of a session cookie —
// how an external agent and its runner call the API.
export function apiKeyApi(apiKey: string) {
  return treaty(app, { headers: { 'x-api-key': apiKey } });
}

// Treaty client that authenticates with the instance SCIM token — how an identity
// provider calls /scim/v2.
export function scimApi(token: string) {
  return treaty(app, { headers: { authorization: `Bearer ${token}` } });
}

// Treaty client bound to the internal instance, sending the worker token — how the
// worker and the bot call /internal/*.
export function internalApi(token: string) {
  return treaty(internalApp, { headers: { 'x-worker-token': token } });
}

export type Api = typeof api;
