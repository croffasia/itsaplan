import type { McpApp } from './types';
import type { McpRouteTool } from './generate';
import { MCP_LOOPBACK_HEADER, setMcpOAuthToken } from '../shared/mcp-request';
import type { McpCredential } from './credential';
import { structuredResult, toolError, type StructuredResult } from './result';
import { withPublicAttachmentUrls, withStoredAttachmentUrls } from './attachment-urls';
import { documentResponse, isDocumentResponseTool } from './document-response';

// Elysia's router needs a multi-label host to parse the path; a single-label host
// like "http://x" fails to route. localhost is never resolved (app.handle runs in
// process), so it is only a syntactically valid base for the URL.
const BASE = 'http://localhost';

// Runs a tool call as an in-process request against the real route and returns the
// response body as text. Path params fill the URL; the remaining arguments become
// the JSON body when the route declares one, otherwise the query string. The
// caller's API credential is forwarded to the route session guard so permission
// checks run exactly as they do over HTTP.
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
  credential: McpCredential,
  opts: { viaMcpEndpoint: boolean },
): Promise<{ text: string; isError: boolean; structuredContent: StructuredResult }> {
  const rest = withStoredAttachmentUrls(args);
  const invalid = (text: string) => ({
    text,
    isError: true,
    structuredContent: toolError(400, text),
  });
  if (isDocumentResponseTool(tool.name)) {
    if (rest.includeContentJson !== undefined && typeof rest.includeContentJson !== 'boolean')
      return invalid('includeContentJson must be a boolean.');
    delete rest.includeContentJson;
  }

  let path = tool.path;
  for (const name of tool.pathParams) {
    const value = rest[name];
    // URL parsing resolves a "." or ".." segment, which would reach another route.
    if (
      (typeof value !== 'string' && typeof value !== 'number') ||
      String(value).trim() === '' ||
      value === '.' ||
      value === '..' ||
      (typeof value === 'number' && !Number.isFinite(value))
    )
      return invalid(`Required path argument ${name} must be a non-empty string or number.`);
    path = path.replace(`:${name}`, encodeURIComponent(String(value)));
    delete rest[name];
  }

  const hasBody = tool.hasBody;
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
      ...(credential.kind === 'api-key' ? { 'x-api-key': credential.apiKey } : {}),
      // Marks this as an MCP call so guards enforce the per-project MCP toggle.
      ...(opts.viaMcpEndpoint ? { [MCP_LOOPBACK_HEADER]: '1' } : {}),
    },
    body,
  });
  if (credential.kind === 'oauth') setMcpOAuthToken(request, credential.accessToken);
  const response = await app.handle(request);
  const raw = await response.text();
  const text = withPublicAttachmentUrls(
    response.status >= 400 ? raw : documentResponse(tool.name, raw, args),
  );
  return {
    text,
    isError: response.status >= 400,
    structuredContent: structuredResult(response, text, tool.method, tool.outputSchema),
  };
}
