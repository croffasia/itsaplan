import { app } from '../../app';
import { routeTools } from '../../mcp/generate';

// The routes matching `match` that carry no MCP tool tag, as "METHOD /path". A route
// opts in with mcpTool() in its detail, so a feature's test pins which of its routes
// stay session-only.
export function untaggedRoutes(match: (route: string) => boolean): string[] {
  const tagged = new Set(routeTools(app).map((tool) => `${tool.method} ${tool.path}`));
  return app.routes
    .map((route) => `${route.method} ${route.path}`)
    .filter(match)
    .filter((route) => !tagged.has(route));
}
