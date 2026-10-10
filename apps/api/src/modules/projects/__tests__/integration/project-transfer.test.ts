import { beforeEach, describe, expect, it } from 'bun:test';
import { apiKeyApi, authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createAgent } from '#tests/helpers/agents';
import { createOwnWorkspace } from '#modules/workspaces/service';
import { setOwnedWorkspaceLimit } from '#shared/limits';

async function setup() {
  const user = await signUpTestUser();
  const api = authedApi(user.cookie);
  const source = (await api.projects.post({ key: 'MOVE', name: 'Project' })).data!;
  const target = (await api.teams.post({ name: 'Destination', slug: 'destination' })).data!;
  return { user, api, source, target };
}

describe('project transfers', () => {
  beforeEach(resetDb);

  it('previews without changing ownership, then preserves the project and its work', async () => {
    const { api, source, target } = await setup();
    const before = (await api.projects({ projectKey: source.ref }).get()).data!;
    const issue = (
      await api.projects({ projectKey: source.ref }).issues.post({
        title: 'Keep this work',
        columnId: before.columns[0].id,
      })
    ).data!;
    await api.projects({ projectKey: source.ref }).preferences.patch({ isFavorite: true });
    const preview = await api
      .projects({ projectKey: source.ref })
      .transfer.preview.post({ targetTeamId: target.id });
    expect(preview.status).toBe(200);
    expect(preview.data).toMatchObject({
      projectId: source.id,
      sourceTeamId: source.teamId,
      targetTeamId: target.id,
      targetRef: 'destination.MOVE',
      canTransfer: true,
      blockers: [],
    });
    expect((await api.projects({ projectKey: source.ref }).get()).data?.project.teamId).toBe(
      source.teamId,
    );
    const moved = await api.projects({ projectKey: source.ref }).transfer.post({
      targetTeamId: target.id,
      sourceTeamId: source.teamId,
      projectId: source.id,
    });
    expect(moved.status).toBe(200);
    expect(moved.data).toMatchObject({
      id: source.id,
      key: source.key,
      ref: 'destination.MOVE',
      teamId: target.id,
    });
    const after = (await api.projects({ projectKey: 'destination.MOVE' }).get()).data!;
    expect(after.columns).toEqual(before.columns);
    expect(after.issueTypes).toEqual(before.issueTypes);
    expect((await api.issues({ issueId: issue.id }).get()).data).toMatchObject({
      id: issue.id,
      projectId: source.id,
      title: issue.title,
    });
    expect((await api.projects.get()).data?.find((p) => p.id === source.id)?.isFavorite).toBe(true);
    expect((await api.projects({ projectKey: source.ref }).get()).status).toBe(404);
  });

  it('retries the same project safely, including after the source key is reused', async () => {
    const { api, source, target } = await setup();
    const body = { targetTeamId: target.id, sourceTeamId: source.teamId, projectId: source.id };
    expect((await api.projects({ projectKey: source.ref }).transfer.post(body)).status).toBe(200);
    const replacement = (await api.projects.post({ key: 'MOVE', name: 'Replacement' })).data!;
    const retry = await api.projects({ projectKey: source.ref }).transfer.post(body);
    expect(retry.status).toBe(200);
    expect(retry.data?.id).toBe(source.id);
    expect((await api.projects({ projectKey: source.ref }).get()).data?.project.id).toBe(
      replacement.id,
    );
  });

  it('retries after the source team slug changes', async () => {
    const { api, source, target } = await setup();
    expect((await api.teams({ teamId: source.teamId }).patch({ slug: 'source' })).status).toBe(200);
    const ref = `source.${source.key}`;
    const body = { targetTeamId: target.id, sourceTeamId: source.teamId, projectId: source.id };
    expect((await api.projects({ projectKey: ref }).transfer.post(body)).status).toBe(200);
    expect(
      (await api.teams({ teamId: source.teamId }).patch({ slug: 'renamed-source' })).status,
    ).toBe(200);
    const retry = await api.projects({ projectKey: ref }).transfer.post(body);
    expect(retry.status).toBe(200);
    expect(retry.data).toMatchObject({ id: source.id, teamId: target.id, ref: 'destination.MOVE' });
  });

  it('blocks duplicate destination keys and leaves the source untouched', async () => {
    const { api, source, target } = await setup();
    await api.teams({ teamId: target.id }).projects.post({ key: 'MOVE', name: 'Existing' });
    const preview = await api
      .projects({ projectKey: source.ref })
      .transfer.preview.post({ targetTeamId: target.id });
    expect(preview.data?.blockers.map((b) => b.code)).toContain('key_conflict');
    expect(
      (
        await api.projects({ projectKey: source.ref }).transfer.post({
          targetTeamId: target.id,
          sourceTeamId: source.teamId,
          projectId: source.id,
        })
      ).status,
    ).toBe(409);
    expect((await api.projects({ projectKey: source.ref }).get()).data?.project.teamId).toBe(
      source.teamId,
    );
  });

  it.each([false, true])(
    'requires memberships and role mappings (destination default: %s)',
    async (useDefault) => {
      const { api, source, target } = await setup();
      const member = await signUpTestUser();
      const memberApi = authedApi(member.cookie);
      const sourceRole = (await api.teams({ teamId: source.teamId }).roles.options.get()).data![0];
      const invite = (
        await api
          .projects({ projectKey: source.ref })
          .invites.post({ email: member.email, role: 'member', roleId: sourceRole.id })
      ).data!;
      await memberApi.invites({ token: invite.token }).accept.post();
      const preview = await api
        .projects({ projectKey: source.ref })
        .transfer.preview.post({ targetTeamId: target.id });
      expect(preview.data?.blockers.map((b) => b.code)).toContain('missing_membership');
      const join = (
        await api.teams({ teamId: target.id }).invites.post({ email: member.email, role: 'member' })
      ).data!;
      await memberApi.invites({ token: join.token }).accept.post();
      const body = { targetTeamId: target.id, sourceTeamId: source.teamId, projectId: source.id };
      expect((await api.projects({ projectKey: source.ref }).transfer.post(body)).status).toBe(409);
      const targetRole = (await api.teams({ teamId: target.id }).roles.options.get()).data![0];
      expect(
        (
          await api.projects({ projectKey: source.ref }).transfer.post({
            ...body,
            roleMappings: [{ sourceRoleId: sourceRole.id, targetRoleId: sourceRole.id }],
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await api.projects({ projectKey: source.ref }).transfer.post({
            ...body,
            roleMappings: [
              { sourceRoleId: sourceRole.id, targetRoleId: useDefault ? null : targetRole.id },
            ],
          })
        ).status,
      ).toBe(200);
      expect((await memberApi.projects({ projectKey: 'destination.MOVE' }).get()).status).toBe(200);
      const members = (await api.projects({ projectKey: 'destination.MOVE' }).members.get()).data!
        .items;
      expect(members.find((m) => m.userId === member.userId)?.roleId).toBe(targetRole.id);
    },
  );

  it('blocks pending invitations and attached agents', async () => {
    const { api, source, target } = await setup();
    await api
      .projects({ projectKey: source.ref })
      .invites.post({ email: 'pending@example.com', role: 'member' });
    const agent = await createAgent(api, source.key, {
      name: 'Worker',
      username: 'worker',
      kind: 'external',
    });
    expect(agent.status).toBe(201);
    const preview = await api
      .projects({ projectKey: source.ref })
      .transfer.preview.post({ targetTeamId: target.id });
    expect(preview.data?.blockers.map((b) => b.code)).toContain('pending_invites');
    expect(preview.data?.blockers.map((b) => b.code)).toContain('agent_members');
  });

  it('rejects missing teams, invalid IDs, mismatched project IDs and source expectations', async () => {
    const { api, source, target } = await setup();
    expect(
      (
        await api
          .projects({ projectKey: source.ref })
          .transfer.preview.post({ targetTeamId: 999999 })
      ).status,
    ).toBe(404);
    expect(
      (await api.projects({ projectKey: source.ref }).transfer.preview.post({ targetTeamId: 0 }))
        .status,
    ).toBe(400);
    expect(
      (
        await api
          .projects({ projectKey: source.ref })
          .transfer.post({ targetTeamId: target.id, sourceTeamId: target.id, projectId: source.id })
      ).status,
    ).toBe(409);
    for (const targetTeamId of [1.5, 2147483648]) {
      expect(
        (await api.projects({ projectKey: source.ref }).transfer.preview.post({ targetTeamId }))
          .status,
      ).toBe(400);
    }
    const other = (await api.projects.post({ key: 'OTHER', name: 'Other' })).data!;
    expect(
      (
        await api.projects({ projectKey: source.ref }).transfer.post({
          targetTeamId: target.id,
          sourceTeamId: source.teamId,
          projectId: other.id,
        })
      ).status,
    ).toBe(409);
  });

  it('requires owner or manager authority on both teams', async () => {
    const admin = await signUpTestUser();
    const adminApi = authedApi(admin.cookie);
    const owner = await signUpTestUser();
    const api = authedApi(owner.cookie);
    const source = (await api.projects.post({ key: 'MOVE', name: 'Project' })).data!;
    const target = (await adminApi.teams.post({ name: 'Destination', slug: 'destination' })).data!;
    const preview = () =>
      api.projects({ projectKey: source.ref }).transfer.preview.post({ targetTeamId: target.id });
    expect((await preview()).status).toBe(404);
    const invite = (
      await adminApi
        .teams({ teamId: target.id })
        .invites.post({ email: owner.email, role: 'member' })
    ).data!;
    await api.invites({ token: invite.token }).accept.post();
    expect((await preview()).status).toBe(403);
    const body = { projectId: source.id, sourceTeamId: source.teamId, targetTeamId: target.id };
    expect((await api.projects({ projectKey: source.ref }).transfer.post(body)).status).toBe(403);
    await adminApi
      .teams({ teamId: target.id })
      .members({ userId: owner.userId })
      .patch({ role: 'manager' });
    expect((await preview()).status).toBe(200);
    expect((await api.projects({ projectKey: source.ref }).transfer.post(body)).status).toBe(200);
  });

  it('refuses agent callers and MCP-disabled destination teams', async () => {
    const { user, api, source, target } = await setup();
    const created = (
      await createAgent(api, source.key, { name: 'Worker', username: 'worker', kind: 'external' })
    ).data!;
    const agentApi = apiKeyApi(created.apiKey!);
    const body = { projectId: source.id, sourceTeamId: source.teamId, targetTeamId: target.id };
    expect((await agentApi.projects({ projectKey: source.ref }).transfer.post(body)).status).toBe(
      403,
    );
    await api.teams({ teamId: target.id }).mcp.patch({ enabled: false });
    const mcpApi = authedApi(user.cookie, { 'x-mcp-loopback': '1' });
    expect(
      (
        await mcpApi
          .projects({ projectKey: source.ref })
          .transfer.preview.post({ targetTeamId: target.id })
      ).status,
    ).toBe(403);
    expect((await mcpApi.projects({ projectKey: source.ref }).transfer.post(body)).status).toBe(
      403,
    );
  });

  it.each(['source', 'target', 'project'] as const)(
    'enforces the %s MCP flag on transfers and retries',
    async (flag) => {
      const { user, api, source, target } = await setup();
      const mcpApi = authedApi(user.cookie, { 'x-mcp-loopback': '1' });
      const body = { projectId: source.id, sourceTeamId: source.teamId, targetTeamId: target.id };
      async function setReach(enabled: boolean, moved = false) {
        const teamId =
          flag === 'target' || (flag === 'project' && moved) ? target.id : source.teamId;
        const patch =
          flag === 'project' ? { projects: [{ projectId: source.id, enabled }] } : { enabled };
        expect((await api.teams({ teamId }).mcp.patch(patch)).status).toBe(200);
      }
      await setReach(false);
      expect(
        (
          await mcpApi
            .projects({ projectKey: source.ref })
            .transfer.preview.post({ targetTeamId: target.id })
        ).status,
      ).toBe(403);
      expect((await mcpApi.projects({ projectKey: source.ref }).transfer.post(body)).status).toBe(
        403,
      );
      await setReach(true);
      expect((await mcpApi.projects({ projectKey: source.ref }).transfer.post(body)).status).toBe(
        200,
      );
      await setReach(false, true);
      expect((await mcpApi.projects({ projectKey: source.ref }).transfer.post(body)).status).toBe(
        403,
      );
    },
  );

  it('rejects a destination in a different workspace', async () => {
    const { user, api, source } = await setup();
    setOwnedWorkspaceLimit(0);
    try {
      const workspaceId = await createOwnWorkspace(
        { id: user.userId, role: 'god' },
        'Other workspace',
      );
      const target = (await api.teams.post({ name: 'Other team', slug: 'other-team', workspaceId }))
        .data!;
      expect(
        (
          await api
            .projects({ projectKey: source.ref })
            .transfer.preview.post({ targetTeamId: target.id })
        ).status,
      ).toBe(409);
      expect(
        (
          await api.projects({ projectKey: source.ref }).transfer.post({
            projectId: source.id,
            sourceTeamId: source.teamId,
            targetTeamId: target.id,
          })
        ).status,
      ).toBe(409);
      expect((await api.projects({ projectKey: source.ref }).get()).data?.project.teamId).toBe(
        source.teamId,
      );
    } finally {
      setOwnedWorkspaceLimit();
    }
  });

  it('blocks archived projects and saved actions without mutating them', async () => {
    const { api, source, target } = await setup();
    await api.projects({ projectKey: source.ref }).actions.post({ name: 'Saved action' });
    await api.teams({ teamId: source.teamId }).projects({ projectId: source.id }).archive.post();
    const body = { projectId: source.id, sourceTeamId: source.teamId, targetTeamId: target.id };
    expect((await api.projects({ projectKey: source.ref }).transfer.post(body)).status).toBe(409);
    await api.teams({ teamId: source.teamId }).projects({ projectId: source.id }).restore.post();
    const preview = await api
      .projects({ projectKey: source.ref })
      .transfer.preview.post({ targetTeamId: target.id });
    expect(preview.data?.blockers.map((b) => b.code)).toContain('project_actions');
    expect((await api.projects({ projectKey: source.ref }).transfer.post(body)).status).toBe(409);
    expect((await api.projects({ projectKey: source.ref }).get()).data?.project.teamId).toBe(
      source.teamId,
    );
  });

  it('serializes competing transfers with only one destination succeeding', async () => {
    const { api, source, target } = await setup();
    const third = (await api.teams.post({ name: 'Third', slug: 'third-team' })).data!;
    const results = await Promise.all(
      [target.id, third.id].map((targetTeamId) =>
        api
          .projects({ projectKey: source.ref })
          .transfer.post({ targetTeamId, sourceTeamId: source.teamId, projectId: source.id }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await api.projects.get()).data?.filter((p) => p.id === source.id)).toHaveLength(1);
  });
});
