import path from 'node:path';
import type { NextConfig } from 'next';

const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL as string);

const nextConfig: NextConfig = {
  // standalone build for a lean docker image.
  output: 'standalone',
  // Monorepo: include the repo root in file tracing for standalone.
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),
  // css-tree loads this JSON at runtime, but Next's standalone tracer does not
  // detect the CommonJS require from its ESM package.
  outputFileTracingIncludes: {
    '/*': ['../../node_modules/.bun/css-tree@*/node_modules/css-tree/data/patch.json'],
  },
  // isomorphic-dompurify loads jsdom on the server, and jsdom reads its own data
  // files (default-stylesheet.css) by a path relative to its module. Bundling it
  // breaks that path, so it is required from node_modules at runtime instead.
  serverExternalPackages: ['isomorphic-dompurify', 'css-tree'],
  // Avatars and attachments are served by the api on its own origin, and the
  // image optimizer only fetches from allowed origins. NEXT_PUBLIC_API_URL is
  // the value the client uses too (src/lib/api.ts) and is set at build time.
  // Spelled out rather than built from a URL, because a URL pattern also pins
  // the query string to the empty one it carries, and a replaced attachment is
  // requested with a cache-busting `?v=`.
  images: {
    remotePatterns: [
      {
        protocol: apiUrl.protocol === 'https:' ? 'https' : 'http',
        hostname: apiUrl.hostname,
        port: apiUrl.port,
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
