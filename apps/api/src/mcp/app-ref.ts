import type { McpApp } from './types';

// The assembled app, captured once at the composition root (app.ts). Two callers
// dispatch tool calls as in-process requests against the real routes (see
// dispatch.ts) and so need the app that owns them: the MCP endpoint, which gets it
// as an argument, and the internal agent runtime, which cannot. app.ts mounts the
// planner, the planner mounts the agent routes, and those reach the runtime — so a
// direct import there would close a cycle. The reference is set at startup instead.

let current: McpApp | null = null;

export function setMcpApp(app: McpApp): void {
  current = app;
}

// Throws when called before startup wired the reference, which is a programming
// error rather than a runtime condition (app.ts sets it as the app is assembled).
export function getMcpApp(): McpApp {
  if (!current) throw new Error('App reference is not set — setMcpApp() must run at startup');
  return current;
}
