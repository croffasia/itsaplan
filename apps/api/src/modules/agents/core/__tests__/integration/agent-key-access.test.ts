import { beforeEach, describe, expect, it } from 'bun:test';
import { authedApi, createProject, type Api } from '#tests/helpers/app';
import { createRole } from '#tests/helpers/roles';
import { addProjectMember } from '#tests/helpers/members';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createAgent, projectIdOf } from '#tests/helpers/agents';

// Regenerating an agent's key, or editing the agent, acts on it across every project
// it works in: the rotated key authenticates as the bot in all of them. The visibility
// check needs only one shared project, so a member who shares just one must not reach
// an agent that also works in a project they are not in.
const agents = (api: Api, teamId: number) => api.teams({ teamId })['ai-agents'];

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  const project = await createProject(asOwner, { key: 'MKT', name: 'Marketing' });
  return { asOwner, teamId: project.data!.teamId };
}

async function handlerRole(asOwner: Api, projectKey: string): Promise<number> {
  const role = await createRole(asOwner, projectKey, {
    name: 'Agent handler',
    permissions: {
      ai_agents: { read: true, create: true, edit: true, delete: true },
      agent_skills: { read: true, edit: true },
      agent_tools: { read: true, edit: true },
    },
  });
  return role.data!.id;
}

describe('agent key / edit requires access to all the agent projects', () => {
  beforeEach(resetDb);

  it('refuses regenerate-key to a member who shares only one of the agent projects', async () => {
    const { asOwner, teamId } = await setup();
    const ops = await asOwner.teams({ teamId }).projects.post({ key: 'OPS', name: 'Operations' });
    const mkt = await projectIdOf(asOwner, 'MKT');
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Bot',
      username: 'bot',
      kind: 'external',
      projectIds: [mkt, ops.data!.id],
    });
    const agentId = created.data!.agent.id;
    const asMember = await addProjectMember(asOwner, 'MKT', await handlerRole(asOwner, 'MKT'));

    expect((await agents(asMember, teamId)({ agentId })['regenerate-key'].post()).status).toBe(403);
    expect((await agents(asMember, teamId)({ agentId }).patch({ name: 'Renamed' })).status).toBe(
      403,
    );
    // Its tools, its skills and the agent itself reach the other projects too.
    expect(
      (await agents(asMember, teamId)({ agentId })['tool-configs'].put({ agentToolIds: [] }))
        .status,
    ).toBe(403);
    expect((await agents(asMember, teamId)({ agentId }).skills.put({ skillIds: [] })).status).toBe(
      403,
    );
    expect((await agents(asMember, teamId)({ agentId }).delete()).status).toBe(403);
  });

  it('refuses the invocation secret to a member who shares only one of the agent projects', async () => {
    const { asOwner, teamId } = await setup();
    const ops = await asOwner.teams({ teamId }).projects.post({ key: 'OPS', name: 'Operations' });
    const mkt = await projectIdOf(asOwner, 'MKT');
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Bot',
      username: 'bot',
      kind: 'external',
      projectIds: [mkt, ops.data!.id],
    });
    const agentId = created.data!.agent.id;
    const asMember = await addProjectMember(asOwner, 'MKT', await handlerRole(asOwner, 'MKT'));
    const agent = agents(asMember, teamId)({ agentId });

    // The secret signs the work the agent runs in every project it works in.
    expect((await agent['invocation-secret'].get()).status).toBe(403);
    expect((await agent['invocation-secret'].post()).status).toBe(403);
    expect((await agent['invocation-test'].post()).status).toBe(403);
    expect((await agents(asOwner, teamId)({ agentId })['invocation-secret'].get()).status).toBe(
      200,
    );
  });

  it('allows the team owner to regenerate the key', async () => {
    const { asOwner, teamId } = await setup();
    const ops = await asOwner.teams({ teamId }).projects.post({ key: 'OPS', name: 'Operations' });
    const mkt = await projectIdOf(asOwner, 'MKT');
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Bot',
      username: 'bot',
      kind: 'external',
      projectIds: [mkt, ops.data!.id],
    });

    const res = await agents(
      asOwner,
      teamId,
    )({ agentId: created.data!.agent.id })['regenerate-key'].post();
    expect(res.status).toBe(200);
  });

  it('allows a member who is in every project the agent works in', async () => {
    const { asOwner, teamId } = await setup();
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Bot',
      username: 'bot',
      kind: 'external',
    });
    const asMember = await addProjectMember(asOwner, 'MKT', await handlerRole(asOwner, 'MKT'));
    const agent = agents(asMember, teamId)({ agentId: created.data!.agent.id });

    expect((await agent['regenerate-key'].post()).status).toBe(200);
    expect((await agent.patch({ name: 'Renamed' })).status).toBe(200);
    expect((await agent['tool-configs'].put({ agentToolIds: [] })).status).toBe(200);
    expect((await agent.skills.put({ skillIds: [] })).status).toBe(200);
    expect((await agent['invocation-secret'].get()).status).toBe(200);
    expect((await agent.delete()).status).toBe(204);
  });

  it('allows a team manager who is in none of the agent projects', async () => {
    const { asOwner, teamId } = await setup();
    const ops = await asOwner.teams({ teamId }).projects.post({ key: 'OPS', name: 'Operations' });
    const mkt = await projectIdOf(asOwner, 'MKT');
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Bot',
      username: 'bot',
      kind: 'external',
      projectIds: [mkt, ops.data!.id],
    });
    const manager = await signUpTestUser();
    const invite = await asOwner
      .teams({ teamId })
      .invites.post({ email: manager.email, role: 'manager' });
    const asManager = authedApi(manager.cookie);
    await asManager.invites({ token: invite.data!.token }).accept.post();

    const res = await agents(
      asManager,
      teamId,
    )({ agentId: created.data!.agent.id })['regenerate-key'].post();
    expect(res.status).toBe(200);
  });

  it('tells each caller whether they may act on the agent as a whole', async () => {
    const { asOwner, teamId } = await setup();
    const ops = await asOwner.teams({ teamId }).projects.post({ key: 'OPS', name: 'Operations' });
    const mkt = await projectIdOf(asOwner, 'MKT');
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Bot',
      username: 'bot',
      kind: 'external',
      projectIds: [mkt, ops.data!.id],
    });
    const agentId = created.data!.agent.id;
    expect(created.data!.agent.canManage).toBe(true);
    const asPartial = await addProjectMember(asOwner, 'MKT', await handlerRole(asOwner, 'MKT'));

    expect((await agents(asPartial, teamId)({ agentId }).get()).data).toMatchObject({
      canManage: false,
    });
    expect((await agents(asPartial, teamId).get({ query: {} })).data).toEqual([
      expect.objectContaining({ id: agentId, canManage: false }),
    ]);
    expect((await agents(asOwner, teamId)({ agentId }).get()).data).toMatchObject({
      canManage: true,
    });
    const set = await agents(asOwner, teamId)({ agentId }).projects.put({ projectIds: [mkt] });
    expect(set.data).toMatchObject({ canManage: true });
    expect((await agents(asPartial, teamId)({ agentId }).get()).data).toMatchObject({
      canManage: true,
    });
  });
});
