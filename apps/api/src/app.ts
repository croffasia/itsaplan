import {
  auth,
  oAuthDiscoveryMetadata,
  oAuthProtectedResourceMetadata,
  trustedOrigins,
  getAuthSettings,
  hasConfiguredEmailProvider,
  hasConfiguredGoogle,
  hasConfiguredOidc,
  getOidcLabel,
} from '@repo/auth';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { Elysia } from 'elysia';
import { planner } from './planner';
import { mountMcp } from './mcp/mount';
import { setMcpApp } from './mcp/app-ref';
import { internalAgentRunRoutes } from './modules/agents/core/internal-routes';
import { internalNotificationRoutes } from './modules/notifications/internal-routes';
import { internalTelegramRoutes } from './modules/telegram/internal-routes';
import { gitWebhookRoutes } from './modules/git/webhook';
import { scimRoutes } from './modules/scim';
import { syncOidcGroupsAfterCallback } from './modules/scim/oidc-sync';
import { normalizeOpenApiResponse } from './openapi';
import pkg from '../../../package.json';

const apiUrl = (process.env.API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const appUrl = (process.env.APP_URL?.split(',')[0]?.trim() || 'http://localhost:3001').replace(
  /\/+$/,
  '',
);
const apiDescription = `REST API for projects, work items, AI agents, Git integrations, analytics, and instance administration.

## Quick start

1. Create a personal API key in [Account settings](${appUrl}/account/api-keys). The key is shown once and carries the same permissions as its owner.
2. Send it in the \`x-api-key\` header. Never put a key in a URL, issue, comment, or source file.
3. Use the project key from the URL in routes containing \`{projectKey}\`. This page is opened from a project, but the API document is instance-wide.

\`\`\`sh
curl "${apiUrl}/projects" \\
  --header "x-api-key: YOUR_PERSONAL_API_KEY"
\`\`\`

JSON errors use \`{ "error": "message" }\` and may also include a stable \`code\`. Pagination parameters and response envelopes are documented per operation.

For agent clients, use the MCP endpoint at [${apiUrl}/mcp](${apiUrl}/mcp). SCIM, worker-internal routes, and repository webhooks use the separate credentials shown on their operations.`;

// The assembled Elysia app, without `.listen()`. `index.ts` imports this and
// binds the port; tests import it and pass it to Eden Treaty to drive routes in
// memory (no network). Keep the chain unbroken so `type App` stays accurate.
export const app = new Elysia()
  .use(
    cors({
      origin: trustedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    }),
  )
  .onAfterHandle({ as: 'global' }, ({ request, response }) =>
    normalizeOpenApiResponse(request, response),
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
          version: pkg.version,
          description: apiDescription,
        },
        servers: [{ url: apiUrl, description: 'Configured public API origin' }],
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
            name: 'Agent Runner',
            description: "Run queue an external agent's runner drains with the agent's API key",
          },
          {
            name: 'Agent Chat',
            description: "Chat with an external agent: the member's messages and its runner's feed",
          },
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
          { name: 'Cycles', description: 'Cycles (time-boxed periods of work) and their issues' },
          { name: 'Attachments', description: 'Issue attachments and raw bytes' },
          {
            name: 'Chat attachments',
            description: 'Files uploaded in an agent chat and their raw bytes',
          },
          { name: 'Imports', description: 'Import drafts that turn an uploaded file into issues' },
          { name: 'Avatars', description: "Current user's avatar image (upload and raw bytes)" },
          { name: 'Views', description: 'Saved work items views' },
          { name: 'Share', description: 'Public read-only sharing of issues and views' },
          { name: 'Actions', description: 'Project automation actions' },
          { name: 'Webhooks', description: 'Outgoing webhook subscriptions' },
          {
            name: 'Git',
            description:
              'Repository integration: the inbound pull request webhook and its per-project settings',
          },
          { name: 'Agent Schedules', description: 'Recurring tasks for internal agents' },
          { name: 'Dashboards', description: 'Saved analytics dashboards' },
          { name: 'Note boards', description: 'Freeform canvases of sticky notes' },
          { name: 'Notifications', description: "The session user's inbox notifications" },
          { name: 'Sync', description: 'Change markers a client polls for live refresh' },
          {
            name: 'Telegram',
            description: "The session user's linked Telegram account",
          },
          {
            name: 'Analytics',
            description: 'Project metrics: stats, pulse, throughput, breakdowns, activity',
          },
          { name: 'Charts', description: 'Chart specs an agent builds to show in a chat' },
          {
            name: 'Webhook test',
            description: 'Test receiver for inspecting webhook deliveries (dev aid)',
          },
          {
            name: 'God',
            description:
              'Instance administration: registration policy, email provider, sign-in providers, ' +
              'SCIM provisioning',
          },
          {
            name: 'SCIM',
            description: 'SCIM 2.0 provisioning, authenticated with the instance SCIM bearer token',
          },
          {
            name: 'System',
            description: 'Liveness, the current session user, and the instance sign-in policy',
          },
          {
            name: 'Internal',
            description:
              'Endpoints the worker and the bot call with the shared WORKER_INTERNAL_TOKEN',
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
            scimBearer: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'opaque',
              description: 'Instance SCIM token generated in God mode.',
            },
            workerToken: {
              type: 'apiKey',
              in: 'header',
              name: 'x-worker-token',
              description: 'Shared token used only by the worker and bot services.',
            },
            gitHubSignature: {
              type: 'apiKey',
              in: 'header',
              name: 'x-hub-signature-256',
              description: 'GitHub HMAC signature generated from the raw request body.',
            },
            gitLabToken: {
              type: 'apiKey',
              in: 'header',
              name: 'x-gitlab-token',
              description: 'GitLab secret token configured on the project webhook.',
            },
            giteaSignature: {
              type: 'apiKey',
              in: 'header',
              name: 'x-gitea-signature',
              description: 'Gitea HMAC signature generated from the raw request body.',
            },
            forgejoSignature: {
              type: 'apiKey',
              in: 'header',
              name: 'x-forgejo-signature',
              description: 'Forgejo HMAC signature generated from the raw request body.',
            },
            bitbucketSignature: {
              type: 'apiKey',
              in: 'header',
              name: 'x-hub-signature',
              description: 'Bitbucket HMAC signature generated from the raw request body.',
            },
          },
        },
        security: [{ apiKey: [] }],
      },
    }),
  )
  // OAuth discovery lives at the API origin because MCP clients resolve the
  // authorization server from protected-resource metadata before entering the
  // Better Auth base path.
  .get('/.well-known/oauth-authorization-server', ({ request }) =>
    oAuthDiscoveryMetadata(auth)(request),
  )
  .get('/.well-known/oauth-protected-resource/mcp', ({ request }) =>
    oAuthProtectedResourceMetadata(auth)(request),
  )
  // better-auth: forward every /api/auth/* request to its handler. The OIDC
  // callback gets one extra step afterwards: folding the provider's `groups` claim
  // into the SCIM group tables, so a group mapped to a project in god mode grants
  // access on an OIDC-only instance too, not just one that also runs a SCIM sync.
  .all('/api/auth/*', async ({ request }) => {
    const response = await auth.handler(request);
    if (new URL(request.url).pathname.startsWith('/api/auth/oauth2/callback/')) {
      await syncOidcGroupsAfterCallback(response);
    }
    return response;
  })
  // Example protected handler: read the session from better-auth.
  .get(
    '/me',
    async ({ request }) => {
      const session = await auth.api.getSession({ headers: request.headers });
      // A deactivated account is not signed in as far as the app is concerned:
      // every planner route answers 401 for it, and this is what the screens ask
      // first. Deactivation arrives over SCIM, after the session was opened.
      if (!session || session.user.active === false) return { authenticated: false };
      return { authenticated: true, user: session.user };
    },
    {
      detail: {
        tags: ['System'],
        summary: 'Get the current session user',
        description:
          'Resolve the request credentials to a session and return the user it belongs to. ' +
          'Without a session, or for a deactivated account, it answers ' +
          '`{ authenticated: false }` instead of failing.',
      },
    },
  )
  // What the sign-in and sign-up screens need before there is a session: whether
  // registration is open, invite-only, or closed, and which sign-in methods are
  // offered. Public on purpose — the screens are reached logged out. It carries no
  // credentials, only the instance's own policy.
  .get(
    '/auth-config',
    async () => {
      const settings = await getAuthSettings();
      const emailEnabled = await hasConfiguredEmailProvider();
      return {
        registration: settings.registration,
        // Both are only usable when the instance can actually send mail.
        magicLink: settings.magicLink && emailEnabled,
        requireEmailVerification: settings.requireEmailVerification && emailEnabled,
        emailEnabled,
        // Whether the email/password form is offered at all. The api refuses to turn
        // it off while no provider below is usable, so this is never false alone.
        emailPassword: settings.emailPassword,
        google: await hasConfiguredGoogle(),
        oidc: await hasConfiguredOidc(),
        // Names the operator's own identity provider, so the button shows it as
        // given. Empty falls back to a translated default.
        oidcLabel: await getOidcLabel(),
      };
    },
    {
      detail: {
        tags: ['System'],
        summary: "Get the instance's sign-in configuration",
        description:
          'Report the registration policy and the sign-in methods the instance offers, so the ' +
          'sign-in and sign-up screens can render before there is a session. Public.',
      },
    },
  )
  // Root doubles as the liveness/health endpoint.
  .get('/', () => ({ name: "It's a Plan api", status: 'ok' }), {
    detail: {
      tags: ['System'],
      summary: 'Check that the api is up',
      description: 'Liveness probe: returns the api name and `status: "ok"`.',
    },
  })
  .use(internalAgentRunRoutes)
  .use(internalNotificationRoutes)
  .use(internalTelegramRoutes)
  // Inbound repository webhook receiver (authenticated by its per-project secret).
  .use(gitWebhookRoutes)
  // SCIM 2.0 provisioning (authenticated by the instance SCIM bearer token). Mounted
  // here rather than under the planner: the planner's session guard would answer 401
  // before the bearer check runs, and its error handler emits a body SCIM does not
  // understand.
  .use(scimRoutes)
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
