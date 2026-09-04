import path from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Two paths that hold only while this repository is the workspace root. A build that
// nests it under another one overrides them; unset, they are what they have always been.
const tracingRoot = process.env.WEB_TRACING_ROOT ?? path.join(import.meta.dirname, '../../');
// Where `@/cloud` resolves. Unset, tsconfig resolves it to src/ce, the stubs a
// self-hosted instance runs.
const cloudUiEntry = process.env.CLOUD_UI_ENTRY;

const nextConfig: NextConfig = {
  // standalone build for a lean docker image.
  output: 'standalone',
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
