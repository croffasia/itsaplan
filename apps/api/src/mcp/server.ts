import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { McpApp } from './types';
import { routeTools } from './generate';
import { dispatchTool } from './dispatch';
import { SERVER_INSTRUCTIONS } from './instructions';

// A low-level MCP Server for one request. tools/list returns every route tagged
// with x-mcp; tools/call dispatches to the real route via app.handle with the
// caller's API key. The low-level Server (not McpServer) is used so the route's
// TypeBox JSON Schema can be served as the tool inputSchema without converting to
// Zod. Arguments are validated by the route itself, not here.
export function buildMcpServer(app: McpApp, apiKey: string): Server {
  const server = new Server(
    // `name` is the stable programmatic identifier; `title` is the human-readable
    // display name a client shows to the user (per the MCP Implementation spec).
    { name: 'itsaplan', title: 'Itsaplan', version: '1.0.0' },
    // `instructions` reaches the client in the initialize response and covers what
    // no single tool description can: which tool resolves ids, how a column is
    // picked, how far a request to "work on an issue" goes.
    { capabilities: { tools: {} }, instructions: SERVER_INSTRUCTIONS },
  );

  const table = routeTools(app);
  const byName = new Map(table.map((t) => [t.name, t]));

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: table.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      annotations: t.annotations,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = byName.get(req.params.name);
    if (!tool) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${req.params.name}` }],
        isError: true,
      };
    }
    const { text, isError } = await dispatchTool(app, tool, req.params.arguments ?? {}, apiKey, {
      viaMcpEndpoint: true,
    });
    return { content: [{ type: 'text', text }], isError };
  });

  return server;
}
