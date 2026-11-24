import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { apiKeyApi, authedApi, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createAgent } from '#tests/helpers/agents';
import { clearLimits, setLimits } from '#tests/helpers/limits';
import { createRole } from '#tests/helpers/roles';
import { addProjectMember } from '#tests/helpers/members';
import { claimDueRuns, enqueueAgentRun } from '../../../core/run-queue';

// The header of the runner queue: the internal runs in flight in the project's
// workspace, against the workspace's limit.

// A person with a project of their own workspace, where `enqueue` queues a run of a new
// agent of the given kind.
async function setup(projectKey = 'RUN') {
  const owner = await signUpTestUser();
  const api = authedApi(owner.cookie);
  await createProject(api, { key: projectKey, name: projectKey });
  const columnId = (await api.projects({ projectKey }).get()).data!.columns[0].id;
  const enqueue = async (kind: 'internal' | 'external', username: string) => {
    const created = (await createAgent(api, projectKey, { name: username, username, kind })).data!;
    const issue = (await api.projects({ projectKey }).issues.post({ columnId, title: username }))
      .data!;
    await enqueueAgentRun({
      agentId: created.agent.id,
      projectId: created.agent.projects[0].id,
      issueId: issue.id,
      sourceActivityId: null,
      prompt: username,
    });
    return created;
  };
  const inFlight = () => api.projects({ projectKey })['agent-runs']['in-flight'].get();
  return { api, workspaceId: owner.workspaceId!, enqueue, inFlight };
}

describe('runs in flight', () => {
  beforeEach(resetDb);
  afterEach(clearLimits);

  it("counts the claimed runs of internal agents against the workspace's limit", async () => {
    const { api, workspaceId, enqueue, inFlight } = await setup();
    await enqueue('internal', 'bot');
    expect((await inFlight()).data).toEqual({ running: 0, limit: 0 });

    await claimDueRuns();
    expect((await inFlight()).data).toEqual({ running: 1, limit: 0 });

    await api.workspaces({ workspaceId }).patch({ maxConcurrentRuns: 2 });
    expect((await inFlight()).data).toEqual({ running: 1, limit: 2 });

    setLimits({ maxConcurrentRuns: 1 });
    expect((await inFlight()).data).toEqual({ running: 1, limit: 1 });
    clearLimits();

    // The instance's limit counts the runs of every workspace, not this one's.
    await api.god['agent-settings'].put({ maxConcurrentRuns: 1 });
    expect((await inFlight()).data).toEqual({ running: 1, limit: 2 });
  });

  it('leaves out the runs of another workspace', async () => {
    const { inFlight } = await setup();
    const other = await setup('OTH');
    await other.enqueue('internal', 'bot');
    await claimDueRuns();

    expect((await other.inFlight()).data).toMatchObject({ running: 1 });
    expect((await inFlight()).data).toMatchObject({ running: 0 });
  });

  it('leaves out the runs of external agents', async () => {
    const { enqueue, inFlight } = await setup();
    const runner = apiKeyApi((await enqueue('external', 'runner')).apiKey!);

    expect((await runner['agent-runs'].claim.post()).data!.run).not.toBeNull();
    expect((await inFlight()).data).toEqual({ running: 0, limit: 0 });
  });

  it("moves the reader's queue marker when a run takes a slot in a project they do not read", async () => {
    const owner = await signUpTestUser();
    const api = authedApi(owner.cookie);
    const { teamId } = (await createProject(api, { key: 'RUN', name: 'Runs' })).data!;
    await api.teams({ teamId }).projects.post({ key: 'HID', name: 'Hidden' });
    const role = (
      await createRole(api, 'RUN', {
        name: 'Reader',
        permissions: { work_items: { read: true }, ai_agents: { read: true } },
      })
    ).data!;
    const reader = await addProjectMember(api, 'RUN', role.id);
    const created = (
      await createAgent(api, 'HID', { name: 'bot', username: 'bot', kind: 'internal' })
    ).data!;
    await enqueueAgentRun({
      agentId: created.agent.id,
      projectId: created.agent.projects[0].id,
      issueId: null,
      sourceActivityId: null,
      prompt: 'hidden',
    });
    const marker = async () =>
      (await reader.sync.rev.get({ query: { scopes: 'runnerQueue:1' } })).data!.revs[
        'runnerQueue:1'
      ];
    const before = await marker();

    await claimDueRuns();
    expect(await marker()).not.toBe(before);
  });

  it('answers whoever may read the agents of the project', async () => {
    const { api } = await setup();
    const reader = (
      await createRole(api, 'RUN', { name: 'Reader', permissions: { ai_agents: { read: true } } })
    ).data!;
    const other = (
      await createRole(api, 'RUN', { name: 'Other', permissions: { work_items: { read: true } } })
    ).data!;
    const asReader = await addProjectMember(api, 'RUN', reader.id);
    const asOther = await addProjectMember(api, 'RUN', other.id);
    const outsider = authedApi((await signUpTestUser()).cookie);
    const read = (who: typeof api) =>
      who.projects({ projectKey: 'RUN' })['agent-runs']['in-flight'].get();

    expect((await read(asReader)).status).toBe(200);
    expect((await read(asOther)).status).toBe(403);
    expect((await read(outsider)).status).toBe(403);
  });
});
