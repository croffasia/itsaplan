import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, type Api } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';

// The project skill library: SKILL.md documents (plus optional reference files) given
// to internal agents. Content lives in the object store; the row holds metadata.
// Access is the ai_agents permission resource. These tests need the object store
// (MinIO), like the attachments test.

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  return { owner, asOwner };
}

const skills = (api: Api) => api.projects({ projectKey: 'MKT' })['agent-skills'];
const agents = (api: Api) => api.projects({ projectKey: 'MKT' })['ai-agents'];

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
    const { asOwner } = await setup();
    const res = await skills(asOwner).post({ source: 'inline', markdown: SKILL_MD });
    expect(res.status).toBe(201);
    expect(res.data).toMatchObject({
      name: 'Triage',
      description: 'How to triage incoming issues',
      source: 'inline',
    });
  });

  it('serves the stored markdown back', async () => {
    const { asOwner } = await setup();
    const created = await skills(asOwner).post({ source: 'inline', markdown: SKILL_MD });
    const md = await skills(asOwner)({ skillId: created.data!.id }).markdown.get();
    expect(md.status).toBe(200);
    expect(md.data?.markdown).toBe(SKILL_MD);
  });

  it('rejects a skill with no resolvable name', async () => {
    const { asOwner } = await setup();
    const res = await skills(asOwner).post({
      source: 'inline',
      markdown: 'Just a body, no frontmatter.',
    });
    expect(res.status).toBe(400);
  });

  it('rejects a duplicate name', async () => {
    const { asOwner } = await setup();
    await skills(asOwner).post({ source: 'inline', markdown: SKILL_MD });
    const dup = await skills(asOwner).post({ source: 'inline', name: 'Triage', markdown: 'body' });
    expect(dup.status).toBe(409);
  });

  it('updates the name and markdown', async () => {
    const { asOwner } = await setup();
    const created = await skills(asOwner).post({ source: 'inline', markdown: SKILL_MD });
    const upd = await skills(asOwner)({ skillId: created.data!.id }).patch({
      name: 'Renamed',
      markdown: 'new body',
    });
    expect(upd.status).toBe(200);
    expect(upd.data).toMatchObject({ name: 'Renamed' });
    const md = await skills(asOwner)({ skillId: created.data!.id }).markdown.get();
    expect(md.data?.markdown).toBe('new body');
  });

  it('adds a reference file and reads its content back', async () => {
    const { asOwner } = await setup();
    const created = await skills(asOwner).post({ source: 'inline', markdown: SKILL_MD });
    const skillId = created.data!.id;

    const withRef = await skills(asOwner)({ skillId }).references.post({
      file: new File(['# Checklist\n\nItem one'], 'checklist.md', { type: 'text/markdown' }),
    });
    expect(withRef.status).toBe(200);
    expect(withRef.data?.files).toHaveLength(1);
    const path = withRef.data!.files[0].path;
    expect(path).toBe('refs/checklist.md');

    const content = await skills(asOwner)({ skillId }).references.content.get({ query: { path } });
    expect(content.status).toBe(200);
    expect(content.data?.content).toBe('# Checklist\n\nItem one');
  });

  it("overwrites a reference file's content and updates its size", async () => {
    const { asOwner } = await setup();
    const created = await skills(asOwner).post({ source: 'inline', markdown: SKILL_MD });
    const skillId = created.data!.id;
    const withRef = await skills(asOwner)({ skillId }).references.post({
      file: new File(['old'], 'checklist.md', { type: 'text/markdown' }),
    });
    const path = withRef.data!.files[0].path;

    const body = '# New\n\nDifferent content';
    const upd = await skills(asOwner)({ skillId }).references.content.patch({
      path,
      content: body,
    });
    expect(upd.status).toBe(200);
    const ref = upd.data?.files.find((f) => f.path === path);
    expect(ref?.size).toBe(Buffer.byteLength(body));

    const after = await skills(asOwner)({ skillId }).references.content.get({ query: { path } });
    expect(after.data?.content).toBe(body);
  });

  it('returns 404 for an unknown reference path on read and write', async () => {
    const { asOwner } = await setup();
    const created = await skills(asOwner).post({ source: 'inline', markdown: SKILL_MD });
    const skillId = created.data!.id;

    const read = await skills(asOwner)({ skillId }).references.content.get({
      query: { path: 'refs/nope.md' },
    });
    expect(read.status).toBe(404);

    const write = await skills(asOwner)({ skillId }).references.content.patch({
      path: 'refs/nope.md',
      content: 'x',
    });
    expect(write.status).toBe(404);
  });

  it('deletes a skill', async () => {
    const { asOwner } = await setup();
    const created = await skills(asOwner).post({ source: 'inline', markdown: SKILL_MD });
    const del = await skills(asOwner)({ skillId: created.data!.id }).delete();
    expect(del.status).toBe(204);
    expect((await skills(asOwner).get()).data).toHaveLength(0);
  });

  it('enables skills on an internal agent and lists them', async () => {
    const { asOwner } = await setup();
    const created = await skills(asOwner).post({ source: 'inline', markdown: SKILL_MD });
    const agent = await agents(asOwner).post({
      name: 'Bot',
      username: 'bot',
      kind: 'internal',
    });
    const agentId = agent.data!.agent.id;

    const set = await agents(asOwner)({ agentId }).skills.put({ skillIds: [created.data!.id] });
    expect(set.status).toBe(200);
    expect(set.data).toHaveLength(1);

    const list = await agents(asOwner)({ agentId }).skills.get();
    expect(list.data?.map((s) => s.id)).toEqual([created.data!.id]);

    // Replacing with an empty set unlinks all skills.
    const clear = await agents(asOwner)({ agentId }).skills.put({ skillIds: [] });
    expect(clear.data).toHaveLength(0);
  });

  it('denies a non-member', async () => {
    await setup();
    const outsider = await signUpTestUser({ name: 'Outsider' });
    const asOutsider = authedApi(outsider.cookie);
    expect((await skills(asOutsider).get()).status).toBe(403);
    expect((await skills(asOutsider).post({ source: 'inline', markdown: SKILL_MD })).status).toBe(
      403,
    );
    // The reference-content routes are gated too (read for GET, edit for PATCH).
    expect(
      (
        await skills(asOutsider)({ skillId: 1 }).references.content.get({
          query: { path: 'refs/x.md' },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await skills(asOutsider)({ skillId: 1 }).references.content.patch({
          path: 'refs/x.md',
          content: 'x',
        })
      ).status,
    ).toBe(403);
  });
});
