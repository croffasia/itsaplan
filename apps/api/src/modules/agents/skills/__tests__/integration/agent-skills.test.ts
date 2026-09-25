import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { untaggedRoutes } from '#tests/helpers/mcp';
import { addProjectMember } from '#tests/helpers/members';
import { createRole } from '#tests/helpers/roles';
import { createAgent } from '#tests/helpers/agents';

// The team skill library: SKILL.md documents (plus optional reference files) given to
// the internal agents of every project the team owns. Content lives in the object
// store; the row holds metadata. Access is the agent_skills permission resource,
// resolved on the team. These tests need the object store (RustFS), like the
// attachments test.

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  const project = await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  return { owner, asOwner, teamId: project.data!.teamId };
}

const skills = (api: Api, teamId: number) => api.teams({ teamId })['agent-skills'];
// The agent routes of the team the project belongs to, which is where agents live.
const agents = (api: Api, teamId: number) => api.teams({ teamId })['ai-agents'];

const SKILL_MD = `---
name: Triage
description: How to triage incoming issues
---

Read the issue, set a priority, and assign it.`;

describe('agent skills', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('creates an inline skill and takes name/description from the frontmatter', async () => {
    const { asOwner, teamId } = await setup();
    const res = await skills(asOwner, teamId).post({ source: 'inline', markdown: SKILL_MD });
    expect(res.status).toBe(201);
    expect(res.data).toMatchObject({
      name: 'Triage',
      description: 'How to triage incoming issues',
      source: 'inline',
    });
  });

  it('serves the stored markdown back', async () => {
    const { asOwner, teamId } = await setup();
    const created = await skills(asOwner, teamId).post({ source: 'inline', markdown: SKILL_MD });
    const md = await skills(asOwner, teamId)({ skillId: created.data!.id }).markdown.get();
    expect(md.status).toBe(200);
    expect(md.data?.markdown).toBe(SKILL_MD);
  });

  it('rejects a skill with no resolvable name', async () => {
    const { asOwner, teamId } = await setup();
    const res = await skills(asOwner, teamId).post({
      source: 'inline',
      markdown: 'Just a body, no frontmatter.',
    });
    expect(res.status).toBe(400);
  });

  it('rejects a duplicate name', async () => {
    const { asOwner, teamId } = await setup();
    await skills(asOwner, teamId).post({ source: 'inline', markdown: SKILL_MD });
    const dup = await skills(asOwner, teamId).post({
      source: 'inline',
      name: 'Triage',
      markdown: 'body',
    });
    expect(dup.status).toBe(409);
  });

  it('updates the name and markdown', async () => {
    const { asOwner, teamId } = await setup();
    const created = await skills(asOwner, teamId).post({ source: 'inline', markdown: SKILL_MD });
    const upd = await skills(
      asOwner,
      teamId,
    )({ skillId: created.data!.id }).patch({
      name: 'Renamed',
      markdown: 'new body',
    });
    expect(upd.status).toBe(200);
    expect(upd.data).toMatchObject({ name: 'Renamed' });
    const md = await skills(asOwner, teamId)({ skillId: created.data!.id }).markdown.get();
    expect(md.data?.markdown).toBe('new body');
  });

  it('adds a reference file and reads its content back', async () => {
    const { asOwner, teamId } = await setup();
    const created = await skills(asOwner, teamId).post({ source: 'inline', markdown: SKILL_MD });
    const skillId = created.data!.id;

    const withRef = await skills(
      asOwner,
      teamId,
    )({ skillId }).references.post({
      file: new File(['# Checklist\n\nItem one'], 'checklist.md', { type: 'text/markdown' }),
    });
    expect(withRef.status).toBe(200);
    expect(withRef.data?.files).toHaveLength(1);
    const path = withRef.data!.files[0].path;
    expect(path).toBe('refs/checklist.md');

    const content = await skills(
      asOwner,
      teamId,
    )({ skillId }).references.content.get({ query: { path } });
    expect(content.status).toBe(200);
    expect(content.data?.content).toBe('# Checklist\n\nItem one');
  });

  it("overwrites a reference file's content and updates its size", async () => {
    const { asOwner, teamId } = await setup();
    const created = await skills(asOwner, teamId).post({ source: 'inline', markdown: SKILL_MD });
    const skillId = created.data!.id;
    const withRef = await skills(
      asOwner,
      teamId,
    )({ skillId }).references.post({
      file: new File(['old'], 'checklist.md', { type: 'text/markdown' }),
    });
    const path = withRef.data!.files[0].path;

    const body = '# New\n\nDifferent content';
    const upd = await skills(
      asOwner,
      teamId,
    )({ skillId }).references.content.patch({
      path,
      content: body,
    });
    expect(upd.status).toBe(200);
    const ref = upd.data?.files.find((f) => f.path === path);
    expect(ref?.size).toBe(Buffer.byteLength(body));

    const after = await skills(
      asOwner,
      teamId,
    )({ skillId }).references.content.get({ query: { path } });
    expect(after.data?.content).toBe(body);
  });

  it('returns 404 for an unknown reference path on read and write', async () => {
    const { asOwner, teamId } = await setup();
    const created = await skills(asOwner, teamId).post({ source: 'inline', markdown: SKILL_MD });
    const skillId = created.data!.id;

    const read = await skills(
      asOwner,
      teamId,
    )({ skillId }).references.content.get({
      query: { path: 'refs/nope.md' },
    });
    expect(read.status).toBe(404);

    const write = await skills(
      asOwner,
      teamId,
    )({ skillId }).references.content.patch({
      path: 'refs/nope.md',
      content: 'x',
    });
    expect(write.status).toBe(404);
  });

  it('pages the library, while the options route answers with all of it', async () => {
    const { asOwner, teamId } = await setup();
    for (const name of ['Alpha', 'Beta', 'Gamma']) {
      await skills(asOwner, teamId).post({
        source: 'inline',
        markdown: `---\nname: ${name}\ndescription: d\n---\n\nbody`,
      });
    }

    const first = await skills(asOwner, teamId).get({ query: { page: 1, pageSize: 2 } });
    expect(first.data).toMatchObject({ total: 3, page: 1, pageSize: 2 });
    expect(first.data?.items.map((s) => s.name)).toEqual(['Alpha', 'Beta']);

    const second = await skills(asOwner, teamId).get({ query: { page: 2, pageSize: 2 } });
    expect(second.data?.items.map((s) => s.name)).toEqual(['Gamma']);

    // No window asked for: the default page, not the whole library.
    const fallback = await skills(asOwner, teamId).get();
    expect(fallback.data).toMatchObject({ page: 1, pageSize: 25, total: 3 });

    const options = await skills(asOwner, teamId).options.get();
    expect(options.data?.map((s) => s.name)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('deletes a skill', async () => {
    const { asOwner, teamId } = await setup();
    const created = await skills(asOwner, teamId).post({ source: 'inline', markdown: SKILL_MD });
    const del = await skills(asOwner, teamId)({ skillId: created.data!.id }).delete();
    expect(del.status).toBe(204);
    expect((await skills(asOwner, teamId).get()).data?.items).toHaveLength(0);
  });

  it('enables skills on an internal agent and lists them', async () => {
    const { asOwner, teamId } = await setup();
    const created = await skills(asOwner, teamId).post({ source: 'inline', markdown: SKILL_MD });
    const agent = await createAgent(asOwner, 'MKT', {
      name: 'Bot',
      username: 'bot',
      kind: 'internal',
    });
    const agentId = agent.data!.agent.id;

    const set = await agents(
      asOwner,
      teamId,
    )({ agentId }).skills.put({ skillIds: [created.data!.id] });
    expect(set.status).toBe(200);
    expect(set.data).toHaveLength(1);

    const list = await agents(asOwner, teamId)({ agentId }).skills.get();
    expect(list.data?.map((s) => s.id)).toEqual([created.data!.id]);

    // Replacing with an empty set unlinks all skills.
    const clear = await agents(asOwner, teamId)({ agentId }).skills.put({ skillIds: [] });
    expect(clear.data).toHaveLength(0);
  });

  it('ignores a skill of another team when enabling skills on an agent', async () => {
    const { asOwner, teamId } = await setup();
    const mine = await skills(asOwner, teamId).post({ source: 'inline', markdown: SKILL_MD });
    const otherTeam = await asOwner.teams.post({ name: 'Design', slug: 'design' });
    const theirs = await skills(asOwner, otherTeam.data!.id).post({
      source: 'inline',
      markdown: SKILL_MD,
    });
    const agent = await createAgent(asOwner, 'MKT', {
      name: 'Bot',
      username: 'bot',
      kind: 'internal',
    });

    const set = await agents(
      asOwner,
      teamId,
    )({ agentId: agent.data!.agent.id }).skills.put({
      skillIds: [mine.data!.id, theirs.data!.id],
    });
    expect(set.data?.map((skill) => skill.id)).toEqual([mine.data!.id]);
  });

  // A skill library is managed over MCP, so every route here is tagged except the file
  // upload: an MCP call carries JSON, and uploading files is left to the UI.
  it('exposes every skill route to MCP', () => {
    const untagged = untaggedRoutes(
      (route) => route.includes('agent-skills') || route.endsWith('/skills'),
    );
    expect(untagged).toEqual(['POST /teams/:teamId/agent-skills/:skillId/references']);
  });

  it('lets a team member read the library when their project role grants it', async () => {
    const { asOwner, teamId } = await setup();
    await skills(asOwner, teamId).post({ source: 'inline', markdown: SKILL_MD });
    const role = await createRole(asOwner, 'MKT', {
      name: 'Skill reader',
      permissions: { agent_skills: { read: true } },
    });
    const asMember = await addProjectMember(asOwner, 'MKT', role.data!.id);

    const list = await skills(asMember, teamId).get();
    expect(list.status).toBe(200);
    expect(list.data?.items).toHaveLength(1);
    // Reading is all that role grants.
    expect(
      (await skills(asMember, teamId).post({ source: 'inline', markdown: 'body' })).status,
    ).toBe(403);
  });

  it('hides the team from someone who does not belong to it', async () => {
    const { teamId } = await setup();
    const outsider = await signUpTestUser({ name: 'Outsider' });
    const asOutsider = authedApi(outsider.cookie);
    expect((await skills(asOutsider, teamId).get()).status).toBe(404);
    expect(
      (await skills(asOutsider, teamId).post({ source: 'inline', markdown: SKILL_MD })).status,
    ).toBe(404);
    // The reference-content routes are gated too (read for GET, edit for PATCH).
    expect(
      (
        await skills(
          asOutsider,
          teamId,
        )({ skillId: 1 }).references.content.get({
          query: { path: 'refs/x.md' },
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await skills(
          asOutsider,
          teamId,
        )({ skillId: 1 }).references.content.patch({
          path: 'refs/x.md',
          content: 'x',
        })
      ).status,
    ).toBe(404);
  });
});
