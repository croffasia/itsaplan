// The minimal surface of the assembled Elysia app the MCP layer uses: route
// introspection and in-process dispatch. A structural type (not Elysia<...>) so a
// concrete app is assignable without hitting Elysia's invariant generics.
export interface McpApp {
  routes: ReadonlyArray<{ method: string; path: string; hooks: unknown }>;
  handle: (request: Request) => Promise<Response>;
}
