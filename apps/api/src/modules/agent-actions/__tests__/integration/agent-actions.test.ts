import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { authedApi, type Api, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createAgent, teamOf } from '#tests/helpers/agents';
import { addProjectMember } from '#tests/helpers/members';
import { createRole } from '#tests/helpers/roles';
import { getProjectByRef } from '#modules/projects/service';
import { getAgentById, getInternalAgentApiKey } from '#modules/agents/core/service';
import { buildRouteTools } from '#modules/agents/core/runtime/tools/route-tools';
import { buildCustomTools } from '#modules/agents/core/runtime/tools/custom-tools';
import { listAgentToolsForRun, setAgentTools } from '#modules/agents/tools/service';
import { createCredential } from '#tests/helpers/integrations';
import { app } from '#tests/helpers/app';
import { db, agentPendingAction } from '@repo/db';
import { eq } from 'drizzle-orm';
import { PENDING_ACTION_TTL_MS, takeDecisionsPreamble } from '#modules/agent-actions/service';

// The agent action log, GET /teams/:teamId/ai-agents/:agentId/actions, one row per write
// tool call, and the approval checkpoint: an agent with requireApproval stores its
// mutating tool calls, which a project member approves or rejects.

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  await createProject(asOwner, { key: 'MKT', name: 'Marketing' });
  const view = await asOwner.projects({ projectKey: 'MKT' }).get();
  const columnId = view.data!.columns[0]!.id;
  return { asOwner, teamId: await teamOf(asOwner, 'MKT'), columnId };
}

// The agent's tool set the way the runtime builds it for a run.
async function agentTools(asOwner: Api, requireApproval: boolean) {
  const created = await createAgent(asOwner, 'MKT', {
    name: 'Scout',
    username: 'scout',
    kind: 'internal',
    tools: ['create_issue', 'update_issue', 'create_document'],
    requireApproval,
  });
  const agentId = created.data!.agent.id;
  const project = (await getProjectByRef('MKT', ''))!;
  const agent = (await getAgentById(agentId, project.teamId))!;
  const tools = buildRouteTools(project, await getInternalAgentApiKey(agent), agent.tools, {
    agentId,
    issueId: null,
    runId: null,
    hold: agent.requireApproval,
  });
  const call = (key: string, input: unknown) => tools[key]!.execute!(input as never, {} as never);
  return { agentId, call };
}

const issues = async (api: Api) =>
  (await api.projects({ projectKey: 'MKT' }).issues.search.get({ query: {} })).data!;

describe('agent action log', () => {
  beforeEach(resetDb);

  it('lists the writes the agent made, newest first, with the issue they touched', async () => {
    const { asOwner, teamId, columnId } = await setup();
    const { agentId, call } = await agentTools(asOwner, false);
    const issue = (await call('create_issue', { columnId, title: 'Launch' })) as { id: number };
    await call('update_issue', { issueId: issue.id, title: 'Launch v2' });
    await call('list_issues', {});

    const res = await asOwner.teams({ teamId })['ai-agents']({ agentId }).actions.get({
      query: {},
    });
    expect(res.status).toBe(200);
    expect(res.data!.total).toBe(2);
    expect(res.data!.items.map((item) => item.tool)).toEqual(['update_issue', 'create_issue']);
    expect(res.data!.items[0]).toMatchObject({
      issueId: issue.id,
      runId: null,
      status: 'success',
      error: null,
      approvedByUserId: null,
    });
    expect(res.data!.items[0]!.issueKey).toMatch(/^MKT-\d+$/);
  });

  it('records a failed write with its error', async () => {
    const { asOwner, teamId } = await setup();
    const { agentId, call } = await agentTools(asOwner, false);
    await call('update_issue', { issueId: 999999, title: 'Nope' });

    const res = await asOwner.teams({ teamId })['ai-agents']({ agentId }).actions.get({
      query: {},
    });
    expect(res.data!.items).toEqual([
      expect.objectContaining({ tool: 'update_issue', status: 'failed', issueKey: null }),
    ]);
    expect(res.data!.items[0]!.error).toContain('not found');
  });

  it('records a write that is not on an issue', async () => {
    const { asOwner, teamId } = await setup();
    const { agentId, call } = await agentTools(asOwner, false);
    await call('create_document', { title: 'Notes' });

    const res = await asOwner.teams({ teamId })['ai-agents']({ agentId }).actions.get({
      query: {},
    });
    expect(res.data!.items).toEqual([
      expect.objectContaining({ tool: 'create_document', status: 'success', issueId: null }),
    ]);
  });

  it('filters the log by project and by date range', async () => {
    const { asOwner, teamId, columnId } = await setup();
    const { agentId, call } = await agentTools(asOwner, false);
    await call('create_issue', { columnId, title: 'One' });
    const actions = asOwner.teams({ teamId })['ai-agents']({ agentId }).actions;
    const projectId = (await getProjectByRef('MKT', ''))!.id;
    const hour = 60 * 60 * 1000;
    const past = new Date(Date.now() - hour).toISOString();
    const future = new Date(Date.now() + hour).toISOString();

    expect((await actions.get({ query: { from: past, to: future } })).data!.total).toBe(1);
    expect((await actions.get({ query: { from: future } })).data!.total).toBe(0);
    expect((await actions.get({ query: { to: past } })).data!.total).toBe(0);
    expect((await actions.get({ query: { projectId } })).data!.total).toBe(1);
    expect((await actions.get({ query: { projectId: projectId + 1000 } })).data!.total).toBe(0);
  });

  it('answers 404 for an agent the team does not have', async () => {
    const { asOwner, teamId } = await setup();
    const res = await asOwner.teams({ teamId })['ai-agents']({ agentId: 999999 }).actions.get({
      query: {},
    });
    expect(res.status).toBe(404);
  });

  it('refuses a member whose role does not grant agent_usage read', async () => {
    const { asOwner, teamId } = await setup();
    const { agentId } = await agentTools(asOwner, false);
    const role = await createRole(asOwner, 'MKT', { name: 'Viewer', permissions: {} });
    const asViewer = await addProjectMember(asOwner, 'MKT', role.data!.id);
    const res = await asViewer.teams({ teamId })['ai-agents']({ agentId }).actions.get({
      query: {},
    });
    expect(res.status).toBe(403);
  });
});

describe('approval checkpoint', () => {
  beforeEach(resetDb);

  it('holds a mutating call instead of applying it, and lists it on the issue', async () => {
    const { asOwner, teamId, columnId } = await setup();
    const free = await agentTools(asOwner, false);
    const issue = (await free.call('create_issue', { columnId, title: 'Draft' })) as {
      id: number;
    };
    await asOwner
      .teams({ teamId })
      ['ai-agents']({ agentId: free.agentId })
      .patch({ requireApproval: true });
    const project = (await getProjectByRef('MKT', ''))!;
    const agent = (await getAgentById(free.agentId, project.teamId))!;
    expect(agent.requireApproval).toBe(true);
    const tools = buildRouteTools(project, await getInternalAgentApiKey(agent), agent.tools, {
      agentId: agent.id,
      issueId: null,
      runId: null,
      hold: true,
    });

    const held = await tools.update_issue!.execute!(
      { issueId: issue.id, title: 'Final' } as never,
      {} as never,
    );
    expect(held).toMatchObject({ pendingApproval: true });
    expect((await issues(asOwner))[0]).toMatchObject({ title: 'Draft' });

    const onIssue = await asOwner.issues({ issueId: issue.id })['agent-actions'].get();
    expect(onIssue.status).toBe(200);
    expect(onIssue.data).toEqual([
      expect.objectContaining({ tool: 'update_issue', status: 'pending', agentName: 'Scout' }),
    ]);
  });

  it('applies an approved call as the agent', async () => {
    const { asOwner, teamId, columnId } = await setup();
    const { agentId, call } = await agentTools(asOwner, true);
    expect(await call('create_issue', { columnId, title: 'Held' })).toMatchObject({
      pendingApproval: true,
    });
    expect(await issues(asOwner)).toEqual([]);

    const pending = await asOwner
      .teams({ teamId })
      ['ai-agents']({ agentId })
      ['pending-actions'].get({ query: { status: 'pending' } });
    const actionId = pending.data!.items[0]!.id;

    const approved = await asOwner['agent-actions']({ actionId }).approve.post();
    expect(approved.status).toBe(200);
    expect(approved.data).toMatchObject({ status: 'approved', tool: 'create_issue' });
    expect(await issues(asOwner)).toEqual([expect.objectContaining({ title: 'Held' })]);

    const log = await asOwner.teams({ teamId })['ai-agents']({ agentId }).actions.get({
      query: {},
    });
    expect(log.data!.items).toEqual([
      expect.objectContaining({
        tool: 'create_issue',
        status: 'success',
        approvedByName: 'Owner',
      }),
    ]);

    const again = await asOwner['agent-actions']({ actionId }).approve.post();
    expect(again.status).toBe(409);
  });

  it('rejects a call with a reason and does not apply it', async () => {
    const { asOwner, teamId, columnId } = await setup();
    const { agentId, call } = await agentTools(asOwner, true);
    await call('create_issue', { columnId, title: 'Spam' });
    const pending = await asOwner
      .teams({ teamId })
      ['ai-agents']({ agentId })
      ['pending-actions'].get({ query: {} });
    const actionId = pending.data!.items[0]!.id;

    const rejected = await asOwner['agent-actions']({ actionId }).reject.post({
      reason: 'Not needed',
    });
    expect(rejected.status).toBe(200);
    expect(rejected.data).toMatchObject({ status: 'rejected', reason: 'Not needed' });
    expect(await issues(asOwner)).toEqual([]);

    const empty = await asOwner['agent-actions']({ actionId }).reject.post({ reason: '' });
    expect(empty.status).toBe(400);
    const log = await asOwner.teams({ teamId })['ai-agents']({ agentId }).actions.get({
      query: {},
    });
    expect(log.data!.total).toBe(0);
  });

  it('expires a call not decided in time and applies nothing', async () => {
    const { asOwner, teamId, columnId } = await setup();
    const { agentId, call } = await agentTools(asOwner, true);
    const held = (await call('create_issue', { columnId, title: 'Late' })) as {
      actionId: number;
    };
    await db
      .update(agentPendingAction)
      .set({ createdAt: new Date(Date.now() - PENDING_ACTION_TTL_MS - 1000) })
      .where(eq(agentPendingAction.id, held.actionId));

    const approved = await asOwner['agent-actions']({ actionId: held.actionId }).approve.post();
    expect(approved.status).toBe(409);
    expect(await issues(asOwner)).toEqual([]);
    const listed = await asOwner
      .teams({ teamId })
      ['ai-agents']({ agentId })
      ['pending-actions'].get({ query: { status: 'expired' } });
    expect(listed.data!.items).toEqual([
      expect.objectContaining({ id: held.actionId, status: 'expired' }),
    ]);
  });

  it("puts the decisions in front of the agent's next run once", async () => {
    const { asOwner, columnId } = await setup();
    const { agentId, call } = await agentTools(asOwner, true);
    const held = (await call('create_issue', { columnId, title: 'Spam' })) as {
      actionId: number;
    };
    const projectId = (await getProjectByRef('MKT', ''))!.id;
    expect(await takeDecisionsPreamble(agentId, projectId)).toBe('');

    await asOwner['agent-actions']({ actionId: held.actionId }).reject.post({
      reason: 'Off topic',
    });
    const preamble = await takeDecisionsPreamble(agentId, projectId);
    expect(preamble).toContain(`Call #${held.actionId} (create_issue): rejected. Off topic`);
    expect(await takeDecisionsPreamble(agentId, projectId)).toBe('');
  });

  it('refuses someone outside the project and answers 404 for an unknown call', async () => {
    const { asOwner, columnId } = await setup();
    const { call } = await agentTools(asOwner, true);
    const held = (await call('create_issue', { columnId, title: 'Held' })) as {
      actionId: number;
    };
    const outsider = authedApi((await signUpTestUser({ name: 'Outsider' })).cookie);

    const refused = await outsider['agent-actions']({ actionId: held.actionId }).approve.post();
    expect(refused.status).toBe(403);
    const missing = await asOwner['agent-actions']({ actionId: 999999 }).approve.post();
    expect(missing.status).toBe(404);
  });
});

describe('approval of integration tools', () => {
  beforeEach(resetDb);
  afterEach(() => fetchSpy?.mockRestore());

  let fetchSpy: ReturnType<typeof spyOn> | undefined;

  // A Jina Reader tool enabled on an agent that requires approval, built the way the
  // runtime builds it for a run.
  async function heldReader(asOwner: Api, teamId: number) {
    const { agentId } = await agentTools(asOwner, true);
    const credentialId = await createCredential(asOwner, 'MKT', {
      integrationKey: 'jina',
      credential: { apiKey: 'jina-key-1234' },
    });
    const tool = await asOwner
      .teams({ teamId })
      ['agent-tools'].post({ toolKey: 'jina_reader', credentialId });
    await setAgentTools(agentId, teamId, [tool.data!.id]);
    const project = (await getProjectByRef('MKT', ''))!;
    const tools = buildCustomTools(await listAgentToolsForRun(agentId), {
      agentId,
      projectId: project.id,
      issueId: null,
      runId: null,
      hold: true,
    });
    return { agentId, toolId: tool.data!.id, reader: tools.jina_reader! };
  }

  it('holds the call without sending it, then sends it once approved', async () => {
    const { asOwner, teamId } = await setup();
    fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ data: { title: 'Doc', url: 'https://example.com', content: 'Hi' } }),
    );
    const { agentId, toolId, reader } = await heldReader(asOwner, teamId);

    const held = await reader.execute!({ url: 'https://example.com' } as never, {} as never);
    expect(held).toMatchObject({ pendingApproval: true });
    expect(fetchSpy).not.toHaveBeenCalled();

    const pending = await asOwner
      .teams({ teamId })
      ['ai-agents']({ agentId })
      ['pending-actions'].get({ query: { status: 'pending' } });
    const action = pending.data!.items[0]!;
    expect(action.tool).toBe(`custom:jina_reader:${toolId}`);

    const approved = await asOwner['agent-actions']({ actionId: action.id }).approve.post();
    expect(approved.data).toMatchObject({ status: 'approved' });
    expect(approved.data!.result).toContain('Doc');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('fails the approval when the tool was removed from the agent since', async () => {
    const { asOwner, teamId } = await setup();
    const { agentId, reader } = await heldReader(asOwner, teamId);
    await reader.execute!({ url: 'https://example.com' } as never, {} as never);
    await setAgentTools(agentId, teamId, []);

    const pending = await asOwner
      .teams({ teamId })
      ['ai-agents']({ agentId })
      ['pending-actions'].get({ query: { status: 'pending' } });
    const approved = await asOwner['agent-actions']({
      actionId: pending.data!.items[0]!.id,
    }).approve.post();
    expect(approved.data).toMatchObject({ status: 'failed' });
  });
});

describe('action log outside a held run', () => {
  beforeEach(resetDb);
  afterEach(() => fetchSpy?.mockRestore());

  let fetchSpy: ReturnType<typeof spyOn> | undefined;

  it('logs an integration tool that writes, and not one that reads', async () => {
    const { asOwner, teamId } = await setup();
    fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ ok: true, result: { message_id: 7 }, data: { content: 'Hi' } }),
    );
    const { agentId } = await agentTools(asOwner, false);
    const ids: number[] = [];
    for (const [integrationKey, credential, toolKey] of [
      ['telegram', { botToken: '123:abc', defaultChatId: '42' }, 'telegram_send'],
      ['jina', { apiKey: 'jina-key-1234' }, 'jina_reader'],
    ] as const) {
      const credentialId = await createCredential(asOwner, 'MKT', { integrationKey, credential });
      const tool = await asOwner.teams({ teamId })['agent-tools'].post({ toolKey, credentialId });
      ids.push(tool.data!.id);
    }
    await setAgentTools(agentId, teamId, ids);
    const project = (await getProjectByRef('MKT', ''))!;
    const tools = buildCustomTools(await listAgentToolsForRun(agentId), {
      agentId,
      projectId: project.id,
      issueId: null,
      runId: null,
      hold: false,
    });
    await tools.telegram_send!.execute!({ text: 'Hello' } as never, {} as never);
    await tools.jina_reader!.execute!({ url: 'https://example.com' } as never, {} as never);

    const log = await asOwner.teams({ teamId })['ai-agents']({ agentId }).actions.get({
      query: {},
    });
    expect(log.data!.items).toEqual([
      expect.objectContaining({ tool: `custom:telegram_send:${ids[0]}`, status: 'success' }),
    ]);
  });

  it("logs an agent's write through the MCP endpoint, and not its reads", async () => {
    const { asOwner, teamId, columnId } = await setup();
    const { agentId } = await agentTools(asOwner, false);
    const project = (await getProjectByRef('MKT', ''))!;
    const apiKey = await getInternalAgentApiKey((await getAgentById(agentId, project.teamId))!);
    const rpc = (name: string, args: Record<string, unknown>) =>
      app
        .handle(
          new Request('http://localhost/mcp', {
            method: 'POST',
            headers: {
              authorization: `Bearer ${apiKey}`,
              'content-type': 'application/json',
              accept: 'application/json, text/event-stream',
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'tools/call',
              params: { name, arguments: args },
            }),
          }),
        )
        .then((res) => res.text());
    await rpc('create_issue', { projectKey: 'MKT', columnId, title: 'Via MCP' });
    await rpc('list_issues', { projectKey: 'MKT' });

    const log = await asOwner.teams({ teamId })['ai-agents']({ agentId }).actions.get({
      query: {},
    });
    expect(log.data!.items).toEqual([
      expect.objectContaining({ tool: 'create_issue', status: 'success', runId: null }),
    ]);
  });
});
