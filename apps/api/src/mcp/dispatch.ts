import type { McpApp } from './types';
import type { McpRouteTool } from './generate';
import { MCP_LOOPBACK_HEADER } from '../shared/mcp-request';

// Methods that carry a request body; the rest put their arguments in the query.
const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);

// Elysia's router needs a multi-label host to parse the path; a single-label host
// like "http://x" fails to route. localhost is never resolved (app.handle runs in
// process), so it is only a syntactically valid base for the URL.
const BASE = 'http://localhost';

// Runs a tool call as an in-process request against the real route and returns the
// response body as text. Path params fill the URL; the remaining arguments become
// the JSON body (POST/PUT/PATCH) or the query string (GET/DELETE). The caller's API
// key is forwarded as x-api-key so the route's session guard and permission checks
// run exactly as they do over HTTP.
//
// viaMcpEndpoint says whether the call came from POST /mcp. It is explicit at both
// call sites because it selects a real behaviour: only an MCP call carries the
// loopback header, and only a request carrying that header is subject to the
// per-project MCP toggle. An internal agent run dispatches through the same routes
// but is not MCP, so disabling MCP on a project must not disarm its agents.
export async function dispatchTool(
  app: McpApp,
  tool: McpRouteTool,
  args: Record<string, unknown>,
  apiKey: string,
  opts: { viaMcpEndpoint: boolean },
): Promise<{ text: string; isError: boolean }> {
  const rest: Record<string, unknown> = { ...args };

  let path = tool.path;
  for (const name of tool.pathParams) {
    path = path.replace(`:${name}`, encodeURIComponent(String(rest[name] ?? '')));
    delete rest[name];
  }

  const hasBody = BODY_METHODS.has(tool.method);
  let url = `${BASE}${path}`;
  let body: string | undefined;
  if (hasBody) {
    body = JSON.stringify(rest);
  } else {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(rest)) {
      if (value != null) qs.set(key, String(value));
    }
    const query = qs.toString();
    if (query) url += `?${query}`;
  }

  const request = new Request(url, {
    method: tool.method,
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      // Marks this as an MCP call so guards enforce the per-project MCP toggle.
      ...(opts.viaMcpEndpoint ? { [MCP_LOOPBACK_HEADER]: '1' } : {}),
    },
    body,
  });
  const response = await app.handle(request);
  const text = await response.text();
  return { text, isError: response.status >= 400 };
}
