import { serverRuntimeEnv } from '@/utils/runtimeEnv';

// The api origin is read from the running server, so the policy is built per
// request (src/proxy.ts) rather than frozen into the build with the other headers
// in next.config.ts. A value that is not an absolute URL contributes nothing: the
// policy then only allows same-origin requests.
function apiOrigin(): string {
  try {
    return new URL(serverRuntimeEnv().apiUrl).origin;
  } catch {
    return '';
  }
}

// Inline scripts stay allowed: Next's own flight payload, the next-themes bootstrap
// and RuntimeEnvScript are inline and carry no nonce. A nonce policy is the step
// after this one. Inline styles are what tiptap, Radix, recharts and Scalar emit.
// Images and media come from anywhere: markdown embeds by URL, OAuth profile
// pictures, and the /media proxy on this origin. React evals in development only,
// to rebuild server error stacks in the browser.
export function contentSecurityPolicy(): string {
  const scriptSources =
    process.env.NODE_ENV === 'development'
      ? "'self' 'unsafe-inline' 'unsafe-eval'"
      : "'self' 'unsafe-inline'";
  return [
    "default-src 'self'",
    `script-src ${scriptSources}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https: http:",
    "media-src 'self' data: blob: https: http:",
    "font-src 'self' data:",
    `connect-src 'self' ${apiOrigin()}`.trimEnd(),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}
