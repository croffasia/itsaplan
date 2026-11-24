import { beforeEach, describe, expect, it } from 'bun:test';
import { createAgent } from '#tests/helpers/agents';
import { authedApi, createProject, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { addProjectMember } from '#tests/helpers/members';
import { createRole } from '#tests/helpers/roles';

const allow = { create: true, edit: true, read: true, delete: true };

describe('agent schedule permissions', () => {
  let owner: Api;
  let agentId: number;

  beforeEach(async () => {
    await resetDb();
    owner = authedApi((await signUpTestUser()).cookie);
    await createProject(owner, { key: 'MKT', name: 'Marketing' });
    const created = await createAgent(owner, 'MKT', {
      name: 'Writer',
      username: 'writer',
      kind: 'external',
    });
    agentId = created.data!.agent.id;
  });

  const schedules = (api: Api) => api.projects({ projectKey: 'MKT' })['agent-schedules'];
  const memberWith = async (name: string, permissions: unknown) =>
    addProjectMember(
      owner,
      'MKT',
      (await createRole(owner, 'MKT', { name, permissions })).data!.id,
    );

  it('reads schedules with agent_schedules, not with ai_agents', async () => {
    const agents = await memberWith('Agents', { ai_agents: allow });
    const planner = await memberWith('Planner', { agent_schedules: { read: true } });

    expect((await schedules(agents).get()).status).toBe(403);
    expect((await schedules(planner).get()).status).toBe(200);
  });

  it('refuses a write the role does not hold', async () => {
    const reader = await memberWith('Reader', { agent_schedules: { read: true } });
    const created = await schedules(reader).post({
      name: 'Nightly',
      agentId,
      type: 'cron',
      cron: '0 3 * * *',
      prompt: 'Run',
    });
    expect(created.status).toBe(403);
  });

  it('lets the default role read them', async () => {
    const member = await addProjectMember(owner, 'MKT');
    expect((await schedules(member).get()).status).toBe(200);
  });
});
