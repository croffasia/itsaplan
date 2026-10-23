import { Elysia } from 'elysia';
import { guards } from '#shared/guards';
import { authContext } from '#shared/auth-context';
import type { TeamMembership } from '#shared/access';
import { HttpError } from '#shared/lib';
import { commonErrors } from '#shared/responses';
import { mcpTool } from '#mcp/generate';
import { agentScopeOf, assertFullAgentAccess, getAgentById } from '../core/service';
import {
  agentParams,
  InvocationSecretResponse,
  InvocationTestResponse,
  RotatedInvocationSecretResponse,
} from './model';
import { readInvocationSecret, rotateInvocationSecret } from './secret';
import { testInvocation } from './service';

// The external agent the path addresses, scoped the way the agent routes scope it.
async function requireExternalAgent(agentId: number, membership: TeamMembership) {
  const agent = await getAgentById(agentId, membership.teamId, agentScopeOf(membership));
  if (!agent) throw new HttpError(404, 'Agent not found');
  await assertFullAgentAccess(membership, agentId);
  if (agent.kind !== 'external') {
    throw new HttpError(400, 'Only an external agent is sent its work');
  }
  return agent;
}

// What is needed to set up the endpoint at an external agent's invocation URL. Each
// route requires `edit` on the agents and the access editing the agent takes: the secret
// lets its holder sign work the agent runs in every project it works in, and whoever may
// edit the agent can already point its URL anywhere.
export const agentInvocationRoutes = new Elysia({
  name: 'agent-invocation',
  detail: { tags: ['AI Agents'] },
})
  .use(authContext)
  .use(guards)

  .get(
    '/teams/:teamId/ai-agents/:agentId/invocation-secret',
    async ({ params, membership }) => {
      await requireExternalAgent(params.agentId, membership);
      return { secret: await readInvocationSecret(params.agentId) };
    },
    {
      params: agentParams,
      teamPermission: ['ai_agents', 'edit'],
      response: { 200: InvocationSecretResponse, ...commonErrors },
      detail: {
        summary: 'Read the invocation secret',
        description:
          'The key the requests sent to the invocation URL are signed with, in the ' +
          'X-Itsaplan-Signature header.',
        ...mcpTool('get_ai_agent_invocation_secret'),
      },
    },
  )

  .post(
    '/teams/:teamId/ai-agents/:agentId/invocation-secret',
    async ({ params, membership }) => {
      await requireExternalAgent(params.agentId, membership);
      return { secret: await rotateInvocationSecret(params.agentId) };
    },
    {
      params: agentParams,
      teamPermission: ['ai_agents', 'edit'],
      response: { 200: RotatedInvocationSecretResponse, ...commonErrors },
      detail: {
        summary: 'Rotate the invocation secret',
        description:
          'Issue a new signing key. The next request is signed with it, so the endpoint ' +
          'has to be given it first.',
        // The endpoint keeps verifying with the old key until it is given the new one.
        ...mcpTool('rotate_ai_agent_invocation_secret', { destructiveHint: true }),
      },
    },
  )

  .post(
    '/teams/:teamId/ai-agents/:agentId/invocation-test',
    async ({ params, membership }) => {
      const outcome = await testInvocation(await requireExternalAgent(params.agentId, membership));
      if (!outcome) throw new HttpError(400, 'The agent has no invocation URL');
      return outcome;
    },
    {
      params: agentParams,
      teamPermission: ['ai_agents', 'edit'],
      response: { 200: InvocationTestResponse, ...commonErrors },
      detail: {
        summary: 'Send a test request',
        description:
          "Send a signed ping to the agent's invocation URL and report how the endpoint " +
          'answered.',
        ...mcpTool('test_ai_agent_invocation'),
      },
    },
  );
