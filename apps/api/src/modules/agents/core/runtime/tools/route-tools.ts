import { createTool } from '@mastra/core/tools';
import type { z } from 'zod';
import type { ProjectRow } from '#modules/projects/service';
import { routeTools, type McpInputSchema, type McpRouteTool } from '#mcp/generate';
import { dispatchTool } from '#mcp/dispatch';
import { getMcpApp } from '#mcp/app-ref';
import { ALWAYS_ON_KEYS, normalizeToolKeys, toolMeta } from './catalog';

// The tools an internal agent uses to work in its project, built from the routes
// tagged with mcpTool() — the same table the MCP endpoint serves. A tool call is
// dispatched as an in-process request against the real route with the agent's API
// key, so the route's schema, permission guard, and error model apply unchanged.
// Nothing about an endpoint is restated here: this file only picks which routes an
// agent gets and binds them to its project.
//
// An agent's rights are therefore the intersection of two things: the actions it was
// granted (catalog.ts, stored in ai_agent.tools) and what its project role permits.
// A tool it holds but its role forbids returns the route's normal 403.

// Mastra accepts a JSON Schema wrapped in the ai-sdk schema protocol: an object
// carrying Symbol.for("vercel.ai.schema") alongside the raw schema. The symbol comes
// from the global registry, which is what lets an object built here be recognised by
// the ai-sdk copy bundled inside Mastra. Passing the route's schema through
// unconverted leaves the route's TypeBox definition as the only validator (`validate`
// is undefined, so nothing is checked before dispatch) — invalid model input reaches
// the route and comes back as its normal 400, which the model reads and retries.
// The cast is the seam between the two: Mastra accepts this object at runtime but
// types inputSchema as a Zod schema, and the arguments are a JSON object either way.
const AI_SDK_SCHEMA = Symbol.for('vercel.ai.schema');

function jsonSchemaInput(schema: McpInputSchema): z.ZodType<Record<string, unknown>> {
  return {
    [AI_SDK_SCHEMA]: true,
    _type: undefined,
    jsonSchema: schema,
    validate: undefined,
  } as unknown as z.ZodType<Record<string, unknown>>;
}

function omitFields(schema: McpInputSchema, names: string[]): McpInputSchema {
  const properties = { ...schema.properties };
  for (const name of names) delete properties[name];
  return {
    type: 'object',
    properties,
    required: schema.required.filter((name) => !names.includes(name)),
  };
}

// A route answers with JSON; a 204 answers with nothing. Anything else is handed to
// the model as-is rather than crashing the run.
function parseBody(text: string): unknown {
  if (!text) return { ok: true };
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// Builds the route-backed tools for one agent, keyed by tool id. The read-only
// always-on actions are always included; a mutating action only when its key is in
// enabledActions (the agent's granted actions, from ai_agent.tools).
export function buildRouteTools(
  project: ProjectRow,
  apiKey: string,
  enabledActions: string[] = [],
): Record<string, ReturnType<typeof createTool>> {
  const app = getMcpApp();
  const granted = new Set([...ALWAYS_ON_KEYS, ...normalizeToolKeys(enabledActions)]);
  // An update replaces the board's canvas as a whole, so without the read the agent
  // would send a canvas built from nothing and delete every card already on the board.
  if (granted.has('update_note_board')) granted.add('get_note_board');

  const tools: Record<string, ReturnType<typeof createTool>> = {};
  for (const route of routeTools(app)) {
    if (!granted.has(route.name)) continue;
    tools[route.name] = buildOne(route, project, apiKey);
  }
  return tools;
}

function buildOne(
  route: McpRouteTool,
  project: ProjectRow,
  apiKey: string,
): ReturnType<typeof createTool> {
  const overrides = toolMeta(route.name)?.overrides;
  const bindsProject = route.pathParams.includes('projectKey');
  // Arguments the model never gets to set: projectKey, which the runtime fills in
  // from the agent's own project so a call cannot name another one, plus whatever
  // the catalog hides.
  const hidden = [...(overrides?.hide ?? [])];
  if (bindsProject) hidden.push('projectKey');
  const schema = omitFields(route.inputSchema, hidden);

  return createTool({
    id: route.name,
    description: overrides?.description ?? route.description,
    inputSchema: jsonSchemaInput(schema),
    execute: async (input) => {
      const args: Record<string, unknown> = { ...input };
      for (const name of hidden) delete args[name];
      if (bindsProject) args.projectKey = project.key;
      const { text, isError } = await dispatchTool(getMcpApp(), route, args, apiKey, {
        viaMcpEndpoint: false,
      });
      const body = parseBody(text);
      // A route failure is returned to the model as a result rather than thrown, so
      // it can correct the call instead of the run aborting. Custom tools do the same.
      return isError ? { error: body } : body;
    },
  });
}
