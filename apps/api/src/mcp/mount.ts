import { t } from 'elysia';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import {
  getSessionFromHeaders,
  isAccountDeactivated,
  mcpUnauthorized,
  verifyMcpAccessToken,
} from '@repo/auth';
import { SSE_HEARTBEAT_MS } from '#shared/http';
import { countKeyRequests } from '#shared/key-rate-limit';
import { buildMcpServer } from './server';
import type { McpApp } from './types';
import type { McpCredential } from './credential';

// The API key on the request. MCP clients send Authorization: Bearer <key>;
// x-api-key is also accepted (the REST convention). Returns null when absent.
function extractApiKey(request: Request): string | null {
  const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  return bearer ?? request.headers.get('x-api-key') ?? null;
}

// Adds the MCP endpoint (/mcp) to the app. Mounted on
// the root app, outside the planner session guard, because the MCP handshake is not
// a planner route: auth is resolved here and the key is forwarded to the loopback
// requests the tools make. `app` is captured so the tool generator can read
// app.routes and each tool call can dispatch through app.handle.
//
// Stateless transport (sessionIdGenerator undefined): a fresh server and transport
// per request. Personal API keys remain supported for existing integrations; native
// OAuth is the default route for clients that discover this resource, such as ChatGPT.
// Typed as `any` because it is the composition root: it needs Elysia's route methods to
// register the routes, and Elysia's generics are invariant, so a precise parameter
// type would reject the concrete app. The captured `app` is passed on as McpApp.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mountMcp(app: any): void {
  const mcpApp = app as McpApp;
  app.post(
    '/mcp',
    async ({ request, body }: { request: Request; body: unknown }) => {
      // ?tools=catalog is the only mode besides the default. Another value is refused:
      // a client that asked for a short list must not get the whole table instead.
      const tools = new URL(request.url).searchParams.get('tools');
      if (tools !== null && tools !== 'catalog') {
        return jsonRpcError(400, -32602, 'Unknown value of "tools". Supported: catalog.');
      }
      const serve = async (credential: McpCredential, userId: string) => {
        const server = await buildMcpServer(
          mcpApp,
          credential,
          userId,
          request,
          tools === 'catalog',
        );
        const transport = new WebStandardStreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          keepAliveMs: SSE_HEARTBEAT_MS,
        });
        await server.connect(transport);
        // Pass the body Elysia already parsed so the request stream is not read twice.
        return transport.handleRequest(request, { parsedBody: body });
      };

      const apiKey = extractApiKey(request);
      if (apiKey) {
        const headers = new Headers(request.headers);
        headers.set('x-api-key', apiKey);
        // No session for a value that is not an API key: it may be an OAuth access token,
        // checked below.
        const session = await getSessionFromHeaders(headers);
        // A deactivated account is refused here too, the way shared/auth-context.ts
        // refuses it for every planner route. Deactivation arrives over SCIM or from
        // god mode, after the key was issued.
        if (session && !isAccountDeactivated(session.user)) {
          // One request per JSON-RPC message, a batch included. The tool calls they
          // dispatch are not counted again (requestUser).
          await countKeyRequests(session.session.id, Array.isArray(body) ? body.length : 1);
          return serve({ kind: 'api-key', apiKey }, session.user.id);
        }
      }
      const userId = apiKey ? await verifyMcpAccessToken(apiKey) : null;
      if (apiKey && userId) return serve({ kind: 'oauth', accessToken: apiKey }, userId);
      return mcpUnauthorized();
    },
    {
      body: t.Any(),
      // Kept out of the REST OpenAPI docs: this is a JSON-RPC endpoint, not a REST route.
      detail: { summary: 'MCP Streamable HTTP endpoint', hide: true },
    },
  );
  // The spec allows only an SSE stream or 405 on GET. A stateless server has no stream to
  // offer and no session to end, and a client that gets 404 instead drops the connection.
  app.get('/mcp', methodNotAllowed, { detail: { hide: true } });
  app.delete('/mcp', methodNotAllowed, { detail: { hide: true } });
}

function jsonRpcError(status: number, code: number, message: string, headers?: HeadersInit) {
  return Response.json({ jsonrpc: '2.0', error: { code, message }, id: null }, { status, headers });
}

function methodNotAllowed(): Response {
  return jsonRpcError(405, -32000, 'Method not allowed.', { allow: 'POST' });
}
