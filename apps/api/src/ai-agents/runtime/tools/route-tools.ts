import { createTool } from '@mastra/core/tools';
import type { z } from 'zod';
import type { ProjectRow } from '../../../projects/store';
import { routeTools, type McpInputSchema, type McpRouteTool } from '../../../mcp/generate';
import { dispatchTool } from '../../../mcp/dispatch';
import { getMcpApp } from '../../../mcp/app-ref';
import { ALWAYS_ON_KEYS, normalizeToolKeys } from './catalog';

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

// Drops projectKey from a tool's arguments. The agent belongs to one project and the
// runtime fills the key in itself, so the model neither has to supply it nor can it
// name another project.
function withoutProjectKey(schema: McpInputSchema): McpInputSchema {
  const { projectKey: _bound, ...properties } = schema.properties;
  return {
    type: 'object',
    properties,
    required: schema.required.filter((name) => name !== 'projectKey'),
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
  const bindsProject = route.pathParams.includes('projectKey');
  const schema = bindsProject ? withoutProjectKey(route.inputSchema) : route.inputSchema;

  return createTool({
    id: route.name,
    description: route.description,
    inputSchema: jsonSchemaInput(schema),
    execute: async (input) => {
      const args: Record<string, unknown> = { ...input };
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
