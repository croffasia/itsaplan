import { t } from 'elysia';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { auth } from '@repo/auth';
import { buildMcpServer } from './server';
import type { McpApp } from './types';

// The API key on the request. MCP clients send Authorization: Bearer <key>;
// x-api-key is also accepted (the REST convention). Returns null when absent.
function extractApiKey(request: Request): string | null {
  const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  return bearer ?? request.headers.get('x-api-key') ?? null;
}

// Adds the MCP endpoint (POST /mcp) to the app and returns the same app. Mounted on
// the root app, outside the planner session guard, because the MCP handshake is not
// a planner route: auth is resolved here and the key is forwarded to the loopback
// requests the tools make. `app` is captured so the tool generator can read
// app.routes and each tool call can dispatch through app.handle.
//
// Stateless transport (sessionIdGenerator undefined): a fresh server and transport
// per request. The API key is validated once here so an unauthenticated caller gets
// a 401 instead of a tool list.
// Typed as `any` because it is the composition root: it needs Elysia's `.post` to
// register the route, and Elysia's generics are invariant, so a precise parameter
// type would reject the concrete app. The captured `app` is passed on as McpApp.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mountMcp(app: any): void {
  const mcpApp = app as McpApp;
  app.post(
    '/mcp',
    async ({
      request,
      body,
      set,
    }: {
      request: Request;
      body: unknown;
      set: { status?: number };
    }) => {
      const apiKey = extractApiKey(request);
      if (apiKey) {
        const headers = new Headers(request.headers);
        headers.set('x-api-key', apiKey);
        const session = await auth.api.getSession({ headers });
        if (session) {
          const server = buildMcpServer(mcpApp, apiKey);
          const transport = new WebStandardStreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
          });
          await server.connect(transport);
          // Pass the body Elysia already parsed so the request stream is not read twice.
          return transport.handleRequest(request, { parsedBody: body });
        }
      }
      set.status = 401;
      return {
        error:
          'Authentication required. Send your API key as Authorization: Bearer <key> or x-api-key.',
      };
    },
    {
      body: t.Any(),
      // Kept out of the REST OpenAPI docs: this is a JSON-RPC endpoint, not a REST route.
      detail: { summary: 'MCP Streamable HTTP endpoint', hide: true },
    },
  );
}
