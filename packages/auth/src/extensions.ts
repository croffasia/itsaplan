import type { BetterAuthPlugin } from 'better-auth';

// What a build adds to the instance's better-auth: plugins, the drizzle tables they keep
// (by model name, for the adapter), and paths no request may reach, which the server still
// calls through `auth.api`. Read once, when ./index.ts creates the instance on its first
// use, so a build calls extendAuth before the first request. A later call throws rather
// than going unread.
export interface AuthExtensions {
  plugins: BetterAuthPlugin[];
  schema: Record<string, unknown>;
  disabledPaths: string[];
}

const extensions: AuthExtensions = {
  plugins: [],
  schema: {},
  disabledPaths: [],
};
let read = false;

export function extendAuth(next: Partial<AuthExtensions>): void {
  if (read) throw new Error('extendAuth must run before the auth instance is first used');
  extensions.plugins.push(...(next.plugins ?? []));
  Object.assign(extensions.schema, next.schema);
  extensions.disabledPaths.push(...(next.disabledPaths ?? []));
}

export function readAuthExtensions(): AuthExtensions {
  read = true;
  return extensions;
}
