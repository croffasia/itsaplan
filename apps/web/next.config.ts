import path from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  // standalone build for a lean docker image.
  output: 'standalone',
  // Monorepo: include the repo root in file tracing for standalone.
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),
  // isomorphic-dompurify loads jsdom on the server, and jsdom reads its own data
  // files (default-stylesheet.css) by a path relative to its module. Bundling it
  // breaks that path, so it is required from node_modules at runtime instead.
  serverExternalPackages: ['isomorphic-dompurify'],
  // next dev otherwise appends a block of its own to apps/web/AGENTS.md on every
  // start, which leaves the working tree dirty for anyone running the dev server.
  agentRules: false,
};

export default createNextIntlPlugin('./src/i18n/request.ts')(nextConfig);
