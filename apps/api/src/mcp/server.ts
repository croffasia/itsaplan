import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { agentTeam } from '#modules/agents/core/service';
import { listTeams } from '#modules/teams/service';
import type { McpApp } from './types';
import { routeTools, withoutFields, type McpRouteTool, type ViewedAttachments } from './generate';
import { dispatchTool } from './dispatch';
import { CATALOG_INSTRUCTIONS, SERVER_INSTRUCTIONS } from './instructions';
import type { McpCredential } from './credential';
import { toolFailure } from './result';
import { agentMcpTools, callConfiguredTool, mcpInputSchema } from './configured-tools';
import { PRIMARY_TOOLS, callCatalogTool, catalogTools, executeToolFor } from './catalog';

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
// with x-mcp, and for an agent's key the configured tools enabled on it; tools/call
// dispatches to the real route via app.handle with the caller's API key, or runs the
// configured tool. The low-level Server (not McpServer) is used so the route's
// TypeBox JSON Schema can be served as the tool inputSchema without converting to
// Zod. Arguments are validated by the route itself, not here.
//
// With `catalog` (POST /mcp?tools=catalog), tools/list returns the catalog tools and the
// primary route tools in place of the whole table, whose definitions cost a client that
// loads them eagerly about 150,000 tokens per session. The other route tools are found
// with discover and run through the execute tools.
export async function buildMcpServer(
  app: McpApp,
  credential: McpCredential,
  userId: string,
  clientRequest?: Request,
  catalog = false,
): Promise<Server> {
  const server = new Server(
    // `name` is the stable programmatic identifier; `title` is the human-readable
    // display name a client shows to the user (per the MCP Implementation spec).
    { name: 'itsaplan', title: 'Itsaplan', version: '1.0.0' },
    // `instructions` reaches the client in the initialize response and covers what
    // no single tool description can: which tool resolves ids, how a column is
    // picked, how far a request to "work on an issue" goes.
    {
      capabilities: { tools: {} },
      instructions: catalog ? CATALOG_INSTRUCTIONS : SERVER_INSTRUCTIONS,
    },
  );

  const table = routeTools(app);
  const byName = new Map(table.map((t) => [t.name, t]));
  const teamId = await callerTeam(userId);
  const needsTeam = (tool: McpRouteTool) => tool.pathParams.includes(TEAM_PARAM);

  // A caller whose team is already known does not get to name one.
  const inputSchemaOf = (tool: McpRouteTool) =>
    teamId !== null && needsTeam(tool)
      ? withoutFields(tool.inputSchema, [TEAM_PARAM])
      : tool.inputSchema;

  const catalogDefs = catalog ? catalogTools() : [];
  const listed = catalog ? PRIMARY_TOOLS.flatMap((name) => byName.get(name) ?? []) : table;
  const taken = new Set([...byName.keys(), ...catalogDefs.map((t) => t.name)]);
  const configured = () => agentMcpTools(userId, taken, clientRequest);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      ...catalogDefs,
      ...listed.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: inputSchemaOf(t),
        annotations: t.annotations,
        outputSchema: catalog || t.images ? undefined : t.outputSchema,
      })),
      ...(await configured()).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: mcpInputSchema(t),
      })),
    ],
  }));

  const callRouteTool = async (tool: McpRouteTool, input: Record<string, unknown>) => {
    const args = { ...input };
    if (needsTeam(tool)) {
      if (teamId !== null) args[TEAM_PARAM] = teamId;
      else if (args[TEAM_PARAM] == null) {
        return toolFailure(
          400,
          'teamId is required: no single team follows from your key. Call list_teams and ' +
            'pass the id of the team to act in.',
        );
      }
    }
    const { text, isError, structuredContent } = await dispatchTool(app, tool, args, credential, {
      viaMcpEndpoint: true,
      clientRequest,
    });
    if (tool.images && !isError) return { content: imageContent(text) };
    return { content: [{ type: 'text' as const, text }], isError, structuredContent };
  };

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name } = req.params;
    const args = req.params.arguments ?? {};
    if (catalogDefs.some((t) => t.name === name)) {
      return callCatalogTool(name, args, { table, inputSchemaOf, call: callRouteTool });
    }
    const tool = byName.get(name);
    if (!tool) {
      const own = (await configured()).find((t) => t.name === name);
      if (own) return callConfiguredTool(own, { ...args });
      return toolFailure(404, `Unknown tool: ${name}`);
    }
    // A tool the client was not shown has no annotations on its side, so a direct call
    // would skip the confirmation the execute tools are split for.
    if (catalog && !PRIMARY_TOOLS.includes(name)) {
      return toolFailure(
        400,
        `${name} is not listed in catalog mode. Run it with ${executeToolFor(tool)}.`,
      );
    }
    return callRouteTool(tool, args);
  });

  return server;
}

// The images of an image tool follow a text block that names them in the same order and
// lists the attachments left out. There is no structuredContent (nor an outputSchema to
// require one): Claude Code gives the model structuredContent in place of the text
// block when it is present, and earlier versions dropped the images as well.
function imageContent(text: string) {
  const { images, others } = JSON.parse(text) as ViewedAttachments;
  const named = images.map(({ id, filename, contentType }) => ({ id, filename, contentType }));
  return [
    { type: 'text' as const, text: JSON.stringify({ images: named, others }) },
    ...images.map((image) => ({
      type: 'image' as const,
      data: image.data,
      mimeType: image.contentType,
    })),
  ];
}
