// Marks a request as originating from an MCP tool call. The MCP endpoint runs each
// tool as an in-process loopback request against the real route (see
// mcp/dispatch.ts); it sets this header so access guards can tell an MCP call from
// a normal web/API call and enforce the per-project MCP toggle only on the former.
// A direct caller could forge the header, but doing so only makes the guard treat
// the request as MCP and thus deny MCP-disabled projects — it can add the
// restriction, never remove it, so it is safe to trust.
export const MCP_LOOPBACK_HEADER = 'x-mcp-loopback';

// The project an internal agent's run works in, set on each tool call it dispatches.
// A route that resolves a project by an object's id refuses any other project. Like
// the loopback header, a forged value can only narrow what the caller reaches.
export const AGENT_PROJECT_HEADER = 'x-agent-project';

const oauthTokens = new WeakMap<Request, string>();
const clientRequests = new WeakMap<Request, Request>();

// True when the request came from an MCP tool dispatch.
export function isMcpRequest(headers: Headers): boolean {
  return headers.get(MCP_LOOPBACK_HEADER) === '1';
}

// The project the request is bound to, or null when it carries none.
export function boundProjectId(headers: Headers): number | null {
  const value = Number(headers.get(AGENT_PROJECT_HEADER));
  return Number.isInteger(value) && value > 0 ? value : null;
}

export function setMcpOAuthToken(request: Request, token: string): void {
  oauthTokens.set(request, token);
}

export function getMcpOAuthToken(request: Request): string | undefined {
  return oauthTokens.get(request);
}

// A dispatched request has no client address or device; the request that reached POST /mcp
// has them. Like the OAuth token, this link is not in a header, so a client cannot set it.
export function setMcpClientRequest(request: Request, client: Request): void {
  clientRequests.set(request, client);
}

export function getMcpClientRequest(request: Request): Request | undefined {
  return clientRequests.get(request);
}
