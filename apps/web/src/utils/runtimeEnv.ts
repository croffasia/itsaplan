// The per-instance origins the browser needs. A NEXT_PUBLIC_* value is inlined into
// the bundle by `next build`, which pins one build to one instance; these are read
// from the server process on every render and handed to the browser by
// RuntimeEnvScript, so the same build serves any instance.

export interface RuntimeEnv {
  apiUrl: string;
  privacyUrl: string;
  termsUrl: string;
}

declare global {
  interface Window {
    __ITSAPLAN_ENV__?: RuntimeEnv;
  }
}

// The NEXT_PUBLIC_ prefixed name is still accepted, for a deployment that sets it on
// the container. Both names are read through a computed key: Next inlines a literal
// `process.env.NEXT_PUBLIC_X` at build time, server code included, and only a dynamic
// lookup reaches the running process.
function readOrigin(name: string): string {
  return process.env[name] || process.env[`NEXT_PUBLIC_${name}`] || '';
}

// The api the web server passes the browser's api calls through to (src/proxy.ts).
// Set, the browser reaches the api on the page's own origin, whatever host it was
// opened on, so the session cookie is first-party there too; API_URL is then not
// handed to the browser.
export function apiProxyTarget(): string {
  return process.env.API_PROXY_TARGET?.replace(/\/+$/, '') ?? '';
}

// Where server code (the media routes) reaches the api.
export function serverApiOrigin(): string {
  return process.env.SERVICE_URL_API || apiProxyTarget() || readOrigin('API_URL');
}

// What the browser is handed. An empty apiUrl means "this page's origin".
export function serverRuntimeEnv(): RuntimeEnv {
  return {
    apiUrl: apiProxyTarget() ? '' : readOrigin('API_URL'),
    privacyUrl: readOrigin('PRIVACY_URL'),
    termsUrl: readOrigin('TERMS_URL'),
  };
}

export function runtimeEnv(): RuntimeEnv {
  if (typeof window === 'undefined') {
    const env = serverRuntimeEnv();
    return env.apiUrl ? env : { ...env, apiUrl: serverApiOrigin() };
  }
  const env = window.__ITSAPLAN_ENV__ ?? { apiUrl: '', privacyUrl: '', termsUrl: '' };
  return env.apiUrl ? env : { ...env, apiUrl: window.location.origin };
}
