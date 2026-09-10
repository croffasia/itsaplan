import path from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Two paths that hold only while this repository is the workspace root. A build that
// nests it under another one overrides them; unset, they are what they have always been.
const tracingRoot = process.env.WEB_TRACING_ROOT ?? path.join(import.meta.dirname, '../../');
// Where `@/cloud` resolves. Unset, tsconfig resolves it to src/ce, the stubs a
// self-hosted instance runs.
const cloudUiEntry = process.env.CLOUD_UI_ENTRY;

// Fixed on every response. The Content-Security-Policy is not here: it names the api
// origin, which is read from the environment at startup (utils/runtimeEnv), while this
// list is frozen into the build. It is set per request in src/proxy.ts.
// HSTS is sent on plain http too, where browsers ignore it, so a local instance is
// unaffected and one behind TLS gets it without a second setting.
const SECURITY_HEADERS = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Passkeys are the one powerful feature the app uses; the rest is switched off for
  // this origin and for anything it might embed.
  {
    key: 'Permissions-Policy',
    value:
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), ' +
      'publickey-credentials-get=(self), publickey-credentials-create=(self)',
  },
];

const nextConfig: NextConfig = {
  // standalone build for a lean docker image.
  output: 'standalone',
  poweredByHeader: false,
  headers: async () => [{ source: '/(.*)', headers: SECURITY_HEADERS }],
  // Monorepo: include the repo root in file tracing for standalone.
  outputFileTracingRoot: tracingRoot,
  // isomorphic-dompurify loads jsdom on the server, and jsdom reads its own data
  // files (default-stylesheet.css) by a path relative to its module. Bundling it
  // breaks that path, so it is required from node_modules at runtime instead.
  serverExternalPackages: ['isomorphic-dompurify'],
  // next dev otherwise appends a block of its own to apps/web/AGENTS.md on every
  // start, which leaves the working tree dirty for anyone running the dev server.
  agentRules: false,
  ...(cloudUiEntry ? { turbopack: { resolveAlias: { '@/cloud': cloudUiEntry } } } : {}),
};

export default createNextIntlPlugin('./src/i18n/request.ts')(nextConfig);
