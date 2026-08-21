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
    response: { 200: chartSpec, ...commonErrors },
    detail: {
      summary: 'Build a chart',
      description:
        'Checks a chart spec and returns it. Put the returned spec in your answer ' +
        'inside a fenced block tagged `chart`, where the chart belongs in the text, ' +
        'and the app draws it there:\n\n' +
        '```chart\n{"type":"bar","x":"week","series":[{"key":"created"}],' +
        '"data":[{"week":"W10","created":8}]}\n```\n\n' +
        'Use it instead of writing a table of numbers out, and do not repeat the ' +
        'numbers next to it. Nothing is stored.\n\n' +
        'Pick the type by the question the chart answers:\n' +
        '- bar — one number per category; `horizontal` for long names or a ranking\n' +
        '- line, area — a number over time; `stacked` on an area for what it is made of\n' +
        '- bar or area with `stacked: "percent"` — how a composition shifts over time\n' +
        '- pie, radial — the parts of one total, up to about six of them\n' +
        '- treemap — the same parts when there are more than that\n' +
        '- funnel — how many are left at each stage, given rows that only fall\n' +
        '- radar — several categories scored on the same scale\n' +
        '- scatter — whether two numbers move together\n' +
        '- a `type` on a single series — a count as bars with an average as a line',
      ...mcpTool('create_chart', { readOnlyHint: true, idempotentHint: true }),
    },
  });
