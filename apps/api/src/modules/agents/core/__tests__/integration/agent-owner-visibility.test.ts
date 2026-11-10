import { beforeEach, describe, expect, it } from 'bun:test';
import { aiAgent, db } from '@repo/db';
import { eq } from 'drizzle-orm';
import { authedApi, createProject } from '#tests/helpers/app';
import { createRole } from '#tests/helpers/roles';
import { auth } from '@repo/auth';
import { app } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

async function setup() {
  const owner = await signUpTestUser();
  const admin = authedApi(owner.cookie);
  const project = (await createProject(admin, { key: 'MKT', name: 'Marketing' })).data!;
  const ops = (await createProject(admin, { key: 'OPS', name: 'Operations' })).data!;
  const role = (
    await createRole(admin, 'MKT', {
      name: 'Agent handler',
      permissions: {
        ai_agents: { read: true, create: true, edit: true, delete: true },
        agent_tools: { read: true, edit: true },
        agent_skills: { read: true, edit: true },
      },
    })
  ).data!;
  const person = await signUpTestUser();
  const member = authedApi(person.cookie);
  const invite = (
    await admin
      .projects({ projectKey: 'MKT' })
      .invites.post({ email: person.email, role: 'member', roleId: role.id })
  ).data!;
  await member.invites({ token: invite.token }).accept.post();
  const peerPerson = await signUpTestUser();
  const peer = authedApi(peerPerson.cookie);
  const peerInvite = (
    await admin
      .projects({ projectKey: 'MKT' })
      .invites.post({ email: peerPerson.email, role: 'member', roleId: role.id })
  ).data!;
  await peer.invites({ token: peerInvite.token }).accept.post();
  return { admin, member, peer, person, peerPerson, project, ops, teamId: project.teamId };
}

describe('agent owner visibility', () => {
  beforeEach(resetDb);

  for (const projectIds of [undefined, []]) {
    it(`keeps an owned unattached agent visible with ${projectIds ? 'empty' : 'omitted'} projectIds`, async () => {
      const { admin, member, peer, person, project, teamId } = await setup();
      const agents = member.teams({ teamId })['ai-agents'];
      const created = await agents.post({
        name: 'Owned',
        username: 'owned',
        kind: 'external',
        projectIds,
      });
      expect(created.status).toBe(201);
      const id = created.data!.agent.id;
      expect(created.data!.agent.projects).toEqual([]);
      expect(created.data!.agent.ownerUserId).toBe(person.userId);
      expect((await agents.get()).data!.map((a) => a.id)).toContain(id);
      expect((await agents({ agentId: id }).get()).status).toBe(200);
      expect(
        (await peer.teams({ teamId })['ai-agents'].get()).data!.map((a) => a.id),
      ).not.toContain(id);
      expect((await peer.teams({ teamId })['ai-agents']({ agentId: id }).get()).status).toBe(404);
      expect(
        (await agents.get({ query: { projectId: project.id } })).data!.map((a) => a.id),
      ).not.toContain(id);
      const other = (
        await admin.teams.post({
          name: 'Other',
          slug: 'other',
          workspaceId: (await admin.workspaces.get()).data![0].id,
        })
      ).data!;
      await admin.teams({ teamId: other.id }).projects.post({ key: 'OTHER', name: 'Other' });
      const otherInvite = (
        await admin
          .projects({ projectKey: 'OTHER' })
          .invites.post({ email: person.email, role: 'member' })
      ).data!;
      await member.invites({ token: otherInvite.token }).accept.post();
      expect(
        (await member.teams({ teamId: other.id })['ai-agents']({ agentId: id }).get()).status,
      ).toBe(404);
      expect(
        (await agents({ agentId: id }).projects.put({ projectIds: [project.id] })).status,
      ).toBe(200);
      expect((await agents({ agentId: id }).get()).status).toBe(200);
      expect((await agents({ agentId: id }).delete()).status).toBe(204);
    });
  }

  it('keeps full-agent checks when the owner shares none of its projects', async () => {
    const { admin, member, peer, project, ops, teamId } = await setup();
    const created = (
      await member
        .teams({ teamId })
        ['ai-agents'].post({ name: 'Owned', username: 'owned', kind: 'external' })
    ).data!;
    const id = created.agent.id;
    await admin
      .teams({ teamId })
      ['ai-agents']({ agentId: id })
      .projects.put({ projectIds: [ops.id] });
    const agent = member.teams({ teamId })['ai-agents']({ agentId: id });
    expect((await agent.get()).data?.canManage).toBe(false);
    expect((await member.teams({ teamId })['ai-agents'].get()).data!.map((a) => a.id)).toContain(
      id,
    );
    expect((await peer.teams({ teamId })['ai-agents']({ agentId: id }).get()).status).toBe(404);
    expect((await agent['tool-configs'].get()).status).toBe(200);
    expect((await agent.skills.get()).status).toBe(200);
    expect(
      (await peer.teams({ teamId })['ai-agents']({ agentId: id })['tool-configs'].get()).status,
    ).toBe(404);
    expect((await peer.teams({ teamId })['ai-agents']({ agentId: id }).skills.get()).status).toBe(
      404,
    );
    expect((await agent.patch({ name: 'Changed' })).status).toBe(403);
    expect((await agent.delete()).status).toBe(403);
    expect((await agent['regenerate-key'].post()).status).toBe(403);
    expect((await agent['invocation-secret'].get()).status).toBe(403);
    expect((await agent['invocation-secret'].post()).status).toBe(403);
    expect((await agent['tool-configs'].put({ agentToolIds: [] })).status).toBe(403);
    expect((await agent.skills.put({ skillIds: [] })).status).toBe(403);
    expect((await agent.projects.put({ projectIds: [ops.id] })).status).toBe(403);
    expect((await agent.projects.put({ projectIds: [project.id] })).status).toBe(200);
    expect((await agent.get()).data!.projects.map((p) => p.id).sort()).toEqual(
      [project.id, ops.id].sort(),
    );
  });

  it("keeps the agent visible to its creator after an admin chooses the 'owner' scope", async () => {
    const { admin, member, person, teamId } = await setup();
    const created = (
      await member
        .teams({ teamId })
        ['ai-agents'].post({ name: 'Runner', username: 'runner', kind: 'external' })
    ).data!;
    expect(created.agent.ownerUserId).toBe(person.userId);
    const changed = await admin
      .teams({ teamId })
      ['ai-agents']({ agentId: created.agent.id })
      .patch({ runnerScope: 'owner' });
    expect(changed.status).toBe(200);
    expect(changed.data!.ownerUserId).toBe(person.userId);
    expect(
      (await member.teams({ teamId })['ai-agents']({ agentId: created.agent.id }).get()).status,
    ).toBe(200);
  });

  it('applies ownership visibility to personal API keys and MCP without leaking to a peer', async () => {
    const { member, person, peerPerson, teamId } = await setup();
    const id = (
      await member
        .teams({ teamId })
        ['ai-agents'].post({ name: 'MCP owner', username: 'mcpowner', kind: 'external' })
    ).data!.agent.id;
    async function call(userId: string, name: string) {
      const key = (await auth.api.createApiKey({ body: { userId, name: 'test-mcp' } })).key;
      const response = await app.handle(
        new Request('http://localhost/mcp', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${key}`,
            'content-type': 'application/json',
            accept: 'application/json, text/event-stream',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: {
              name,
              arguments: { teamId, ...(name === 'get_ai_agent' ? { agentId: id } : {}) },
            },
          }),
        }),
      );
      const text = await response.text();
      return JSON.parse(text.slice(text.indexOf('data: ') + 6)).result;
    }
    const own = await call(person.userId, 'list_ai_agents');
    expect(own.isError).not.toBe(true);
    expect(JSON.parse(own.content[0].text).map((a: { id: number }) => a.id)).toContain(id);
    expect((await call(person.userId, 'get_ai_agent')).isError).not.toBe(true);
    const theirs = await call(peerPerson.userId, 'list_ai_agents');
    expect(theirs.isError).not.toBe(true);
    expect(JSON.parse(theirs.content[0].text).map((a: { id: number }) => a.id)).not.toContain(id);
    expect((await call(peerPerson.userId, 'get_ai_agent')).isError).toBe(true);
  });

  it('does not infer an owner for legacy rows with a null owner', async () => {
    const { admin, member, teamId } = await setup();
    const created = (
      await member
        .teams({ teamId })
        ['ai-agents'].post({ name: 'Legacy', username: 'legacy', kind: 'external' })
    ).data!;
    await db.update(aiAgent).set({ ownerUserId: null }).where(eq(aiAgent.id, created.agent.id));
    expect(
      (await member.teams({ teamId })['ai-agents']({ agentId: created.agent.id }).get()).status,
    ).toBe(404);
    const legacy = await admin.teams({ teamId })['ai-agents']({ agentId: created.agent.id }).get();
    expect(legacy.status).toBe(200);
    expect(legacy.data).toMatchObject({ ownerUserId: null, ownerName: null });
  });
});
