// Marks a request as originating from an MCP tool call. The MCP endpoint runs each
// tool as an in-process loopback request against the real route (see
// mcp/dispatch.ts); it sets this header so access guards can tell an MCP call from
// a normal web/API call and enforce the per-project MCP toggle only on the former.
// A direct caller could forge the header, but doing so only makes the guard treat
// the request as MCP and thus deny MCP-disabled projects — it can add the
// restriction, never remove it, so it is safe to trust.
export const MCP_LOOPBACK_HEADER = 'x-mcp-loopback';

// True when the request came from an MCP tool dispatch.
export function isMcpRequest(headers: Headers): boolean {
  return headers.get(MCP_LOOPBACK_HEADER) === '1';
}
