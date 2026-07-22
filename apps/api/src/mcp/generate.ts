import type { McpApp } from './types';

// Turns the assembled app's routes into MCP tool descriptors. A route opts in by
// carrying an `x-mcp` extension in its OpenAPI `detail` (see mcpTool). The route's
// own TypeBox schemas and permission guard stay the single source of truth: the
// generated tool only forwards a call to the route through app.handle (dispatch.ts),
// so validation, permissions, and the error model are reused, never duplicated.

// The JSON Schema an MCP client receives for a tool's arguments. TypeBox emits
// JSON Schema, so the route schemas are merged into this shape as-is.
export interface McpInputSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required: string[];
}

// Behaviour hints an MCP client reads to decide what a tool may do — chiefly
// whether a call needs the user's confirmation before it runs. Hints, not
// guarantees: the route's guard is still what actually enforces anything.
export interface McpToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface McpRouteTool {
  name: string;
  description: string;
  method: string;
  // The route path template, e.g. "/projects/:projectKey/issues".
  path: string;
  // Path param names parsed from the template, e.g. ["projectKey"].
  pathParams: string[];
  inputSchema: McpInputSchema;
  annotations: McpToolAnnotations;
}

// Marks a route as an MCP tool. Spread into a route's `detail`:
//
//   detail: { summary: "Create an issue", ...mcpTool("create_issue") }
//
// The HTTP method already states how a route behaves, so it supplies the
// annotations by default (see methodAnnotations). Pass the second argument only
// where the method understates it — a POST that revokes a credential or turns
// down an invite is destructive even though POST as a class is not:
//
//   detail: { ...mcpTool("regenerate_ai_agent_key", { destructiveHint: true }) }
//
// `x-mcp` is an OpenAPI extension key, so it rides along in the route's detail,
// is read back from app.routes by generateRouteTools, and does not show up as a
// real field in the REST/OpenAPI docs.
export function mcpTool(
  tool: string,
  annotations?: McpToolAnnotations,
): { 'x-mcp': { tool: string; annotations?: McpToolAnnotations } } {
  return { 'x-mcp': { tool, annotations } };
}

// What the HTTP method alone says about a route. A GET only reads; a DELETE
// removes and repeats harmlessly; PUT/PATCH replace in place, so repeating one
// lands on the same state; POST creates, so it does not.
function methodAnnotations(method: string): McpToolAnnotations {
  switch (method.toUpperCase()) {
    case 'GET':
      return { readOnlyHint: true, destructiveHint: false, idempotentHint: true };
    case 'DELETE':
      return { readOnlyHint: false, destructiveHint: true, idempotentHint: true };
    case 'PUT':
    case 'PATCH':
      return { readOnlyHint: false, destructiveHint: false, idempotentHint: true };
    default:
      return { readOnlyHint: false, destructiveHint: false, idempotentHint: false };
  }
}

function extractPathParams(path: string): string[] {
  return [...path.matchAll(/:([^/]+)/g)].map((m) => m[1]);
}

// hooks.params/query/body hold the TypeBox schema the route declared (a JSON
// Schema object with `properties`/`required`). Merge the three into one object
// schema for the tool's arguments. Path params are always added as required: a
// route often omits an explicit `params` schema for a string id, which would
// otherwise leave the path param out of the tool's arguments entirely.
function mergeInputSchema(hooks: Record<string, unknown>, pathParams: string[]): McpInputSchema {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const key of ['params', 'query', 'body'] as const) {
    const schema = hooks[key] as
      { properties?: Record<string, unknown>; required?: unknown } | undefined;
    if (!schema?.properties) continue;
    Object.assign(properties, schema.properties);
    if (Array.isArray(schema.required)) required.push(...(schema.required as string[]));
  }
  for (const name of pathParams) {
    if (!(name in properties)) {
      properties[name] = { type: 'string', description: `Path parameter '${name}'.` };
    }
    required.push(name);
  }
  return { type: 'object', properties, required: [...new Set(required)] };
}

// The tool table derived from an app's routes, built once per app and cached: routes
// are fixed after boot, so introspection runs on the first call only. Shared by the
// MCP endpoint and the internal agent runtime, which build their tools from the same
// table. Keyed by the app so a second app (a test's) gets its own table instead of
// inheriting whichever one was generated first.
const cache = new WeakMap<McpApp, McpRouteTool[]>();
export function routeTools(app: McpApp): McpRouteTool[] {
  let tools = cache.get(app);
  if (!tools) {
    tools = generateRouteTools(app);
    cache.set(app, tools);
  }
  return tools;
}

function generateRouteTools(app: McpApp): McpRouteTool[] {
  const tools: McpRouteTool[] = [];
  for (const route of app.routes) {
    const hooks = route.hooks as Record<string, unknown>;
    const detail = hooks.detail as
      | {
          summary?: string;
          description?: string;
          'x-mcp'?: { tool?: string; annotations?: McpToolAnnotations };
        }
      | undefined;
    const tool = detail?.['x-mcp']?.tool;
    if (!tool) continue;
    const pathParams = extractPathParams(route.path);
    tools.push({
      name: tool,
      // The MCP tool description is the full text an LLM reads to pick a tool.
      // Prefer the route's `description` (the long explanation); fall back to the
      // short `summary` (the OpenAPI title) and then the tool name.
      description: detail?.description ?? detail?.summary ?? tool,
      method: route.method,
      path: route.path,
      pathParams,
      inputSchema: mergeInputSchema(hooks, pathParams),
      // Every tool acts on this tracker's own data and reaches nothing outside it,
      // so openWorldHint is false throughout; the route may still override it.
      annotations: {
        ...methodAnnotations(route.method),
        openWorldHint: false,
        ...detail?.['x-mcp']?.annotations,
      },
    });
  }
  return tools;
}
