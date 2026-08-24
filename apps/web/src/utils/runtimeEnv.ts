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

export function serverRuntimeEnv(): RuntimeEnv {
  return {
    apiUrl: readOrigin('API_URL'),
    privacyUrl: readOrigin('PRIVACY_URL'),
    termsUrl: readOrigin('TERMS_URL'),
  };
}

export function runtimeEnv(): RuntimeEnv {
  if (typeof window === 'undefined') return serverRuntimeEnv();
  return window.__ITSAPLAN_ENV__ ?? { apiUrl: '', privacyUrl: '', termsUrl: '' };
}
