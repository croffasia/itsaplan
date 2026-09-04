import { t } from 'elysia';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { auth, withMcpAuth } from '@repo/auth';
import { buildMcpServer } from './server';
import type { McpApp } from './types';
import type { McpCredential } from './credential';

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
// per request. Personal API keys remain supported for existing integrations; native
// OAuth is the default route for clients that discover this resource, such as ChatGPT.
// Typed as `any` because it is the composition root: it needs Elysia's `.post` to
// register the route, and Elysia's generics are invariant, so a precise parameter
// type would reject the concrete app. The captured `app` is passed on as McpApp.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mountMcp(app: any): void {
  const mcpApp = app as McpApp;
  app.post(
    '/mcp',
    async ({ request, body }: { request: Request; body: unknown }) => {
      const serve = async (credential: McpCredential) => {
        const server = buildMcpServer(mcpApp, credential);
        const transport = new WebStandardStreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
        });
        await server.connect(transport);
        // Pass the body Elysia already parsed so the request stream is not read twice.
        return transport.handleRequest(request, { parsedBody: body });
      };

      const apiKey = extractApiKey(request);
      if (apiKey) {
        const headers = new Headers(request.headers);
        headers.set('x-api-key', apiKey);
        try {
          const session = await auth.api.getSession({ headers });
          // A deactivated account is refused here too, the way shared/auth-context.ts
          // refuses it for every planner route. Deactivation arrives over SCIM, after
          // the key was issued.
          if (session && session.user.active !== false) return serve({ kind: 'api-key', apiKey });
        } catch {
          // Not an API key: let the native OAuth handler validate the bearer token.
        }
      }
      // withMcpAuth verifies the native OAuth token and returns the standard MCP
      // WWW-Authenticate challenge that clients use for OAuth discovery.
      return withMcpAuth(auth, (_request, oauthSession) =>
        serve({ kind: 'oauth', accessToken: oauthSession.accessToken }),
      )(request);
    },
    {
      body: t.Any(),
      // Kept out of the REST OpenAPI docs: this is a JSON-RPC endpoint, not a REST route.
      detail: { summary: 'MCP Streamable HTTP endpoint', hide: true },
    },
  );
}
