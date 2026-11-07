import { beforeEach, describe, expect, it } from 'bun:test';
import { createAgent } from '#tests/helpers/agents';
import { authedApi, createProject, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { addProjectMember } from '#tests/helpers/members';
import { createRole } from '#tests/helpers/roles';

const agents = (api: Api) => api.projects({ projectKey: 'MKT' })['ai-agents'].options.get();

describe('GET /projects/:projectKey/ai-agents/options', () => {
  let owner: Api;

  beforeEach(async () => {
    await resetDb();
    owner = authedApi((await signUpTestUser()).cookie);
    await createProject(owner, { key: 'MKT', name: 'Marketing' });
    await createProject(owner, { key: 'OPS', name: 'Operations' });
    await createAgent(owner, 'MKT', { name: 'Writer', username: 'writer', kind: 'external' });
    await createAgent(owner, 'OPS', { name: 'Runner', username: 'runner', kind: 'external' });
  });

  it('names the agents of the project to a member who may not read them', async () => {
    const role = await createRole(owner, 'MKT', {
      name: 'No agents',
      permissions: { ai_agents: { read: false } },
    });
    const member = await addProjectMember(owner, 'MKT', role.data!.id);

    const { status, data } = await agents(member);
    expect(status).toBe(200);
    expect(data).toEqual([
      { id: expect.any(Number), name: 'Writer', kind: 'external', model: null },
    ]);
  });

  it('is closed to someone outside the project', async () => {
    const stranger = authedApi((await signUpTestUser()).cookie);
    expect((await agents(stranger)).status).toBe(403);
  });
});
