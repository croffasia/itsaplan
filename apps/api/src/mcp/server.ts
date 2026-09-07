import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { agentTeam } from '#modules/agents/core/service';
import { listTeams } from '#modules/teams/service';
import type { McpApp } from './types';
import { routeTools, withoutFields, type McpRouteTool } from './generate';
import { dispatchTool } from './dispatch';
import { SERVER_INSTRUCTIONS } from './instructions';
import type { McpCredential } from './credential';

// The path param of every team-scoped route.
const TEAM_PARAM = 'teamId';

// The team the caller's tool calls act in, or null when they have to name one.
//
// A client knows projects, not teams, so the team is resolved from the key rather
// than asked for: an agent key acts in the team its agent belongs to, and a person
// with a single team acts in that one. A person in several teams names the team on
// each call. It is never resolved from projectKey — an agent has to be creatable in
// a team that holds no project.
async function callerTeam(userId: string): Promise<number | null> {
  const ofAgent = await agentTeam(userId);
  if (ofAgent !== null) return ofAgent;
  const teams = await listTeams(userId, { mcpOnly: true });
  return teams.length === 1 ? teams[0].id : null;
}

// A low-level MCP Server for one request. tools/list returns every route tagged
// with x-mcp; tools/call dispatches to the real route via app.handle with the
// caller's API key. The low-level Server (not McpServer) is used so the route's
// TypeBox JSON Schema can be served as the tool inputSchema without converting to
// Zod. Arguments are validated by the route itself, not here.
export async function buildMcpServer(
  app: McpApp,
  credential: McpCredential,
  userId: string,
): Promise<Server> {
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
  const teamId = await callerTeam(userId);
  const needsTeam = (tool: McpRouteTool) => tool.pathParams.includes(TEAM_PARAM);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: table.map((t) => ({
      name: t.name,
      description: t.description,
      // A caller whose team is already known does not get to name one.
      inputSchema:
        teamId !== null && needsTeam(t)
          ? withoutFields(t.inputSchema, [TEAM_PARAM])
          : t.inputSchema,
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
    const args = { ...(req.params.arguments ?? {}) };
    if (needsTeam(tool)) {
      if (teamId !== null) args[TEAM_PARAM] = teamId;
      else if (args[TEAM_PARAM] == null) {
        return {
          content: [
            {
              type: 'text',
              text:
                'teamId is required: no single team follows from your key. Call list_teams and ' +
                'pass the id of the team to act in.',
            },
          ],
          isError: true,
        };
      }
    }
    const { text, isError } = await dispatchTool(app, tool, args, credential, {
      viaMcpEndpoint: true,
    });
    return { content: [{ type: 'text', text }], isError };
  });

  return server;
}
