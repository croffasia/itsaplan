import { Elysia } from 'elysia';
import { guards } from '#shared/guards';
import { authContext } from '#shared/auth-context';
import { mcpTool } from '#mcp/generate';
import { commonErrors } from '#shared/responses';
import { chartSpec } from './model';

// Building a chart is one endpoint and nothing else: it checks a spec and answers
// with it. Nothing is stored — the chart lives in the answer the agent writes, in a
// ```chart fence holding the spec, which is what the chat draws in place (see the web
// app's markdownSegments). A tool call is shown as its own block, so a chart placed
// that way could not sit between two sentences; the fence can.
//
// The round trip is what makes the format one thing rather than three: this schema is
// the create_chart tool's arguments for an internal agent and an MCP client alike (see
// mcp/generate.ts), and a spec the model got wrong comes back as a 400 it can correct
// instead of a chart nobody can draw.
export const chartRoutes = new Elysia({ name: 'charts', detail: { tags: ['Charts'] } })
  .use(authContext)
  .use(guards)
  .post('/projects/:projectKey/charts', ({ body }) => body, {
    body: chartSpec,
    projectMember: true,
    feature: 'dashboards',
    response: { 200: chartSpec, ...commonErrors },
    detail: {
      summary: 'Build a chart',
      description:
        'Check a chart spec and return it. Put the returned spec in your answer, where the chart ' +
        'belongs, in a fenced block tagged `chart`. The app draws it there:\n\n' +
        '```chart\n' +
        '{"type":"bar","x":"week","series":[{"key":"created"}],"data":[{"week":"W10","created":8}]}\n' +
        '```\n\n' +
        'Use a chart instead of a table of numbers, and do not repeat the numbers next to it. ' +
        'Nothing is stored. Use pie or radial for up to about six parts of a total, and treemap ' +
        'for more. A funnel needs values that only fall.',
      ...mcpTool('create_chart', { readOnlyHint: true, idempotentHint: true }),
    },
  });
