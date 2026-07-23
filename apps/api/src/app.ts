import {
  auth,
  trustedOrigins,
  getAuthSettings,
  hasConfiguredEmailProvider,
  hasConfiguredGoogle,
} from '@repo/auth';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { Elysia } from 'elysia';
import { planner } from './planner';
import { webhookTestRoutes } from './webhook-test/routes';
import { mountMcp } from './mcp/mount';
import { setMcpApp } from './mcp/app-ref';
import { internalAgentRunRoutes } from './ai-agents/internal-routes';
import { internalNotificationRoutes } from './notifications/internal-routes';
import { internalTelegramRoutes } from './telegram/internal-routes';

// The assembled Elysia app, without `.listen()`. `index.ts` imports this and
// binds the port; tests import it and pass it to Eden Treaty to drive routes in
// memory (no network). Keep the chain unbroken so `type App` stays accurate.
export const app = new Elysia()
  .use(
    cors({
      origin: trustedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  )
  // OpenAPI docs. Mounted on the main app (outside the planner's session guard)
  // so the UI at /docs and the spec at /docs/json are reachable without a
  // session. The spec is generated from the `t` schemas on every route.
  .use(
    swagger({
      path: '/docs',
      // Render with Scalar's own "default" theme to match the better-auth reference
      // at /api/auth/reference. `customCss: ""` drops the gradient theme that
      // @elysiajs/swagger injects by default (it falls back to elysiajsTheme only
      // when customCss is null/undefined).
      scalarConfig: {
        theme: 'default',
        customCss: '',
      },
      documentation: {
        info: {
          title: "It's a Plan API",
          version: '1.0.0',
          description: 'REST API for projects, issues, and their dependent entities.\n\n',
        },
        tags: [
          { name: 'Projects', description: 'Projects and the full work items view' },
          { name: 'Members', description: 'Project membership and roles' },
          { name: 'Roles', description: 'Project roles and their permissions' },
          { name: 'Invites', description: 'Project invites (create, accept, reject)' },
          { name: 'Columns', description: 'Work items columns and their order' },
          { name: 'Issue Types', description: 'Per-project issue types' },
          { name: 'Labels', description: 'Labels and label groups' },
          { name: 'AI Agents', description: 'AI agents attached to a project' },
          {
            name: 'Integrations',
            description: 'Stored integration credentials (LLM keys and tool creds)',
          },
          { name: 'Agent Skills', description: 'Skill library given to internal agents' },
          {
            name: 'Agent Tools',
            description: 'Tools configured on a credential and given to agents',
          },
          { name: 'Custom Fields', description: 'Global and type-scoped custom fields' },
          { name: 'Issues', description: 'Issues, their fields, feed, and comments' },
          {
            name: 'Initiatives',
            description: 'Initiatives (issue groupings) and their activity feed',
          },
          { name: 'Attachments', description: 'Issue attachments and raw bytes' },
          { name: 'Avatars', description: "Current user's avatar image (upload and raw bytes)" },
          { name: 'Views', description: 'Saved work items views' },
          { name: 'Share', description: 'Public read-only sharing of issues and views' },
          { name: 'Actions', description: 'Project automation actions' },
          { name: 'Webhooks', description: 'Outgoing webhook subscriptions' },
          { name: 'Agent Schedules', description: 'Recurring tasks for internal agents' },
          { name: 'Dashboards', description: 'Saved analytics dashboards' },
          { name: 'Note boards', description: 'Freeform canvases of sticky notes' },
          { name: 'Notifications', description: "The session user's inbox notifications" },
          {
            name: 'Telegram',
            description: "The session user's linked Telegram account",
          },
          {
            name: 'Analytics',
            description: 'Project metrics: stats, pulse, throughput, breakdowns, activity',
          },
          {
            name: 'Webhook test',
            description: 'Test receiver for inspecting webhook deliveries (dev aid)',
          },
          {
            name: 'God',
            description:
              'Instance administration: registration policy, email provider, Google sign-in',
          },
        ],
        // Planner routes are session-gated. Besides the session cookie (sent by the
        // browser, not modelled here), a request may carry an `x-api-key` header:
        // better-auth's apiKey plugin resolves it to the owner's session
        // (enableSessionForAPIKeys). Declaring it here lets the Scalar UI at /docs
        // authorize with a key and call the planner routes.
        components: {
          securitySchemes: {
            apiKey: { type: 'apiKey', in: 'header', name: 'x-api-key' },
          },
        },
        security: [{ apiKey: [] }],
      },
    }),
  )
  // better-auth: forward every /api/auth/* request to its handler.
  .all('/api/auth/*', ({ request }) => auth.handler(request))
  // Example protected handler: read the session from better-auth.
  .get('/me', async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return { authenticated: false };
    return { authenticated: true, user: session.user };
  })
  // What the sign-in and sign-up screens need before there is a session: whether
  // registration is open, invite-only, or closed, and which sign-in methods are
  // offered. Public on purpose — the screens are reached logged out. It carries no
  // credentials, only the instance's own policy.
  .get('/auth-config', async () => {
    const settings = await getAuthSettings();
    const emailEnabled = await hasConfiguredEmailProvider();
    return {
      registration: settings.registration,
      // Both are only usable when the instance can actually send mail.
      magicLink: settings.magicLink && emailEnabled,
      requireEmailVerification: settings.requireEmailVerification && emailEnabled,
      emailEnabled,
      google: await hasConfiguredGoogle(),
    };
  })
  // Root doubles as the liveness/health endpoint.
  .get('/', () => ({ name: "It's a Plan api", status: 'ok' }))
  .use(internalAgentRunRoutes)
  .use(internalNotificationRoutes)
  .use(internalTelegramRoutes)
  // Test receiver for inspecting webhook deliveries (unauthenticated, dev aid).
  .use(webhookTestRoutes)
  // Planner API: projects, issues, and their dependent entities.
  .use(planner);

// MCP endpoint (POST /mcp). Added after the chain so `type App` (the Eden client
// type) stays the REST surface; the MCP endpoint is JSON-RPC, not called via Eden.
// Its tools are generated from the planner routes tagged with mcpTool().
mountMcp(app);

// Hands the assembled app to the internal agent runtime, which builds an agent's
// tools from the same mcpTool() routes and dispatches them in process. It cannot
// import this module without a cycle, so the reference is passed here.
setMcpApp(app);

// App type — useful for Eden Treaty (type-safe client) on the frontend and in tests.
export type App = typeof app;
