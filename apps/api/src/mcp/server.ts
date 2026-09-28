import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { agentTeam } from '#modules/agents/core/service';
import { listTeams } from '#modules/teams/service';
import type { McpApp } from './types';
import { routeTools, withoutFields, type McpRouteTool } from './generate';
import { dispatchTool } from './dispatch';
import { SERVER_INSTRUCTIONS } from './instructions';
import type { McpCredential } from './credential';
import { toolError } from './result';
import { documentInputSchema, documentOutputSchema } from './document-response';
import { discoverTools, invocationArguments, listCatalog, type ToolDescriptor } from './catalog';

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

// A low-level MCP Server for one request. tools/list returns the catalog (see
// catalog.ts): by default the common reads and the tools that find and run the
// rest, with `full` every route tagged with x-mcp. tools/call dispatches to the real
// route via app.handle with the caller's API key, whether the tool is named directly
// or through call_read_tool or call_tool. The low-level Server (not McpServer) is
// used so the route's TypeBox JSON Schema can be served as the tool inputSchema
// without converting to Zod. Arguments are validated by the route itself, not here.
export async function buildMcpServer(
  app: McpApp,
  credential: McpCredential,
  userId: string,
  catalog: 'compact' | 'full' = 'compact',
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

  const descriptors: ToolDescriptor[] = table.map((t) => {
    const schema = documentInputSchema(t);
    return {
      name: t.name,
      description: t.description,
      // A caller whose team is already known does not get to name one.
      inputSchema: teamId !== null && needsTeam(t) ? withoutFields(schema, [TEAM_PARAM]) : schema,
      annotations: t.annotations,
      outputSchema: t.images ? undefined : documentOutputSchema(t),
      permission: t.permission,
      images: t.images || undefined,
    };
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => listCatalog(descriptors, catalog));

  const errorResult = (status: number, text: string) => ({
    content: [{ type: 'text' as const, text }],
    isError: true,
    structuredContent: toolError(status, text),
  });

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    let name = req.params.name;
    let args = { ...(req.params.arguments ?? {}) };
    if (name === 'discover_tools') {
      const result = discoverTools(descriptors, args);
      if (result.error !== undefined) return errorResult(400, result.error);
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        isError: false,
        structuredContent: { ok: true, status: 200, data: result },
      };
    }
    const readOnly = name === 'call_read_tool';
    const invoked = readOnly || name === 'call_tool';
    if (invoked) {
      const parsed = invocationArguments.safeParse(args);
      if (!parsed.success) return errorResult(400, parsed.error.message);
      name = parsed.data.name;
      args = parsed.data.arguments;
    }
    const tool = byName.get(name);
    if (!tool) {
      return errorResult(404, `Unknown tool: ${name}`);
    }
    if (readOnly && tool.annotations.readOnlyHint !== true)
      return errorResult(
        400,
        `${name} can change data. Use call_tool after checking its description.`,
      );
    // Images reach the model as image content, which call_read_tool and call_tool
    // cannot return: both promise a structured result.
    if (invoked && tool.images)
      return errorResult(400, `${name} returns images. Call it by its own name.`);
    if (needsTeam(tool)) {
      if (teamId !== null) args[TEAM_PARAM] = teamId;
      else if (args[TEAM_PARAM] == null) {
        const text =
          'teamId is required: no single team follows from your key. Call list_teams and ' +
          'pass the id of the team to act in.';
        return errorResult(400, text);
      }
    }
    const { text, isError, structuredContent } = await dispatchTool(app, tool, args, credential, {
      viaMcpEndpoint: true,
    });
    if (tool.images && !isError) return { content: imageContent(text) };
    return { content: [{ type: 'text', text }], isError, structuredContent };
  });

  return server;
}

interface ViewedAttachments {
  images: { id: string; filename: string; contentType: string; data: string }[];
  others: unknown[];
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
