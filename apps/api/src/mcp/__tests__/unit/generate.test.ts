import { describe, it, expect } from 'bun:test';
import { routeTools, mcpTool, type McpToolAnnotations } from '../../generate';
import type { McpApp } from '../../types';

// routeTools reads app.routes structurally, so a hand-built list of routes is
// enough here: no app, no database, no session.
function appWith(
  routes: Array<{ method: string; path: string; detail: Record<string, unknown> }>,
): McpApp {
  return {
    routes: routes.map((r) => ({ method: r.method, path: r.path, hooks: { detail: r.detail } })),
  } as unknown as McpApp;
}

function annotationsOf(method: string, annotations?: McpToolAnnotations) {
  const app = appWith([
    {
      method,
      path: '/things/:thingId',
      detail: { summary: 'A thing', ...mcpTool('a_tool', annotations) },
    },
  ]);
  return routeTools(app)[0]!.annotations;
}

describe('mcp tool annotations', () => {
  it('marks a GET read-only', () => {
    expect(annotationsOf('GET')).toMatchObject({ readOnlyHint: true, destructiveHint: false });
  });

  it('marks a DELETE destructive and idempotent', () => {
    expect(annotationsOf('DELETE')).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    });
  });

  it('marks PUT and PATCH idempotent but not destructive', () => {
    for (const method of ['PUT', 'PATCH']) {
      expect(annotationsOf(method)).toMatchObject({
        destructiveHint: false,
        idempotentHint: true,
      });
    }
  });

  it('marks a POST neither read-only nor idempotent', () => {
    expect(annotationsOf('POST')).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    });
  });

  it('never claims a tool reaches outside this tracker', () => {
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(annotationsOf(method).openWorldHint).toBe(false);
    }
  });

  // The case the HTTP method gets wrong: a POST that revokes something.
  it('lets a route override what its method implies', () => {
    expect(annotationsOf('POST', { destructiveHint: true })).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
    });
  });
});

describe('mcp tool table', () => {
  it('exposes only routes tagged with mcpTool', () => {
    const app = appWith([
      { method: 'GET', path: '/tagged', detail: { summary: 'Tagged', ...mcpTool('tagged') } },
      { method: 'GET', path: '/untagged', detail: { summary: 'Untagged' } },
    ]);
    expect(routeTools(app).map((t) => t.name)).toEqual(['tagged']);
  });

  it('requires every path param, even without an explicit params schema', () => {
    const app = appWith([
      {
        method: 'GET',
        path: '/projects/:projectKey/issues/:issueId',
        detail: { summary: 'Nested', ...mcpTool('nested') },
      },
    ]);
    const { inputSchema } = routeTools(app)[0]!;
    expect(inputSchema.required).toEqual(['projectKey', 'issueId']);
    expect(inputSchema.properties).toHaveProperty('projectKey');
  });

  it('prefers the long description over the summary', () => {
    const app = appWith([
      {
        method: 'GET',
        path: '/thing',
        detail: { summary: 'Short', description: 'The long one.', ...mcpTool('thing') },
      },
    ]);
    expect(routeTools(app)[0]!.description).toBe('The long one.');
  });
});
