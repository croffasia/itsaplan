import { beforeEach, describe, expect, it } from 'bun:test';
import { db, aiAgent, apikey, teamMember } from '@repo/db';
import { eq } from 'drizzle-orm';
import { authedApi, type Api, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { getProjectByRef } from '#modules/projects/service';
import { getAgentById, getInternalAgentApiKey } from '../../service';
import { actionCatalog, buildRouteTools } from '../../runtime/tools/route-tools';
import { AGENT_ACTIONS, ALWAYS_ON_ACTIONS } from '../../runtime/tools/catalog';
import { routeTools } from '#mcp/generate';
import { getMcpApp } from '#mcp/app-ref';
import { createRole } from '#tests/helpers/roles';
import { createAgent, projectIdOf, setAgentProjectRole } from '#tests/helpers/agents';

// The tools an internal agent runs with, built from the routes tagged mcpTool() and
// dispatched in process with the agent's own API key. What is asserted here is the
// wiring, not the routes themselves (each feature's own test covers those): which
// tools an agent gets, that a call reaches the real route as the agent, that the
// project is bound rather than supplied by the model, and that the agent's project
// role is enforced.

// The agent routes of the team the project belongs to, which is where agents live.
const agents = (api: Api, teamId: number) => api.teams({ teamId })['ai-agents'];

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  const project = await createProject(asOwner, { key: 'MKT', name: 'Marketing' });
  return { owner, asOwner, teamId: project.data!.teamId };
}

// Builds the tool set of a freshly created internal agent, the way the runtime does.
// The username only has to be unique, so it is numbered. A roleId puts the agent's
// membership of MKT on that role, which is what its calls are then checked against.
let agentSeq = 0;
async function toolsFor(asOwner: Api, tools: string[], roleId?: number) {
  const created = await createAgent(asOwner, 'MKT', {
    name: 'Triage Bot',
    username: `triage-${++agentSeq}`,
    kind: 'internal',
    tools,
  });
  const agentId = created.data?.agent.id;
  if (agentId === undefined) throw new Error('Test agent was not created');
  if (roleId !== undefined) {
    await setAgentProjectRole(asOwner, 'MKT', created.data!.agent.userId, roleId);
  }
  const project = await getProjectByRef('MKT', '');
  if (!project) throw new Error('Test project was not created');
  const agent = await getAgentById(agentId, project.id);
  if (!agent) throw new Error('Test agent was not found');
  const apiKey = await getInternalAgentApiKey(agent);
  return buildRouteTools(project, apiKey, agent.tools);
}

type ToolMap = Awaited<ReturnType<typeof toolsFor>>;

async function run(tools: ToolMap, key: string, input: unknown = {}): Promise<unknown> {
  const execute = tools[key]?.execute;
  if (!execute) throw new Error(`Tool ${key} is not available`);
  return execute(input as never, {} as never);
}

describe('internal agent route tools', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('grants the always-on read tools plus only the enabled actions', async () => {
    const { asOwner } = await setup();
    const tools = await toolsFor(asOwner, ['create_issue']);

    // Always-on reads are there without being granted...
    expect(Object.keys(tools)).toEqual(
      expect.arrayContaining(['get_project', 'search_issues', 'list_issues', 'get_issue']),
    );
    // ...the granted action is there...
    expect(tools.create_issue).toBeDefined();
    // ...and an action that was not granted is absent.
    expect(tools.delete_issue).toBeUndefined();
    expect(tools.update_issue).toBeUndefined();
    expect(tools.create_checklist_items).toBeUndefined();
  });

  it('previews project activity only for the internal agent and retains full history', async () => {
    const { asOwner } = await setup();
    const view = await asOwner.projects({ projectKey: 'MKT' }).get();
    const columnId = view.data!.columns[0]!.id;
    const created = await asOwner.projects({ projectKey: 'MKT' }).issues.post({
      columnId,
      title: 'Large description',
    });
    expect(created.status).toBe(201);
    const issueId = created.data!.id;
    const description = 'Description detail. '.repeat(200);
    const updated = await asOwner.issues({ issueId }).patch({ description });
    expect(updated.status).toBe(200);
    const tools = await toolsFor(asOwner, []);

    const result = await run(tools, 'get_project_activity', { action: 'description', limit: 1 });
    expect(result).toMatchObject({
      items: [
        {
          issueId,
          action: 'description',
          payload: { to: { value: description.slice(0, 1000) } },
          truncatedFields: [{ field: 'payload.to.value', originalLength: description.length }],
        },
      ],
      nextCursor: null,
    });

    const rest = await asOwner.projects({ projectKey: 'MKT' }).analytics.activity.get({
      query: { action: 'description' },
    });
    expect(rest.data?.items[0]?.payload.to?.value).toBe(description);
    expect(rest.data?.items[0]).not.toHaveProperty('truncatedFields');
    expect(await run(tools, 'list_issue_activity', { issueId })).toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({
          action: 'description',
          payload: { to: { value: description } },
        }),
      ]),
    });
    expect(await run(tools, 'get_issue', { issueId })).toMatchObject({ description });
  });

  it('keeps project activity cursors and rejects a project supplied by the model', async () => {
    const { asOwner } = await setup();
    await createProject(asOwner, { key: 'OPS', name: 'Operations' });
    const view = await asOwner.projects({ projectKey: 'MKT' }).get();
    const columnId = view.data!.columns[0]!.id;
    for (const title of ['Alpha', 'Beta']) {
      await asOwner.projects({ projectKey: 'MKT' }).issues.post({ columnId, title });
    }
    const tools = await toolsFor(asOwner, []);
    const rest = await asOwner.projects({ projectKey: 'MKT' }).analytics.activity.get({
      query: { limit: 1 },
    });
    const first = await run(tools, 'get_project_activity', { limit: 1, projectKey: 'OPS' });
    expect(first).toMatchObject({ nextCursor: rest.data!.nextCursor });
    const second = await run(tools, 'get_project_activity', {
      limit: 1,
      cursor: JSON.stringify(rest.data!.nextCursor),
    });
    expect(second).toMatchObject({
      items: [expect.objectContaining({ issueTitle: 'Alpha' })],
      nextCursor: null,
    });
  });

  it('preserves project activity errors for an agent without dashboard read permission', async () => {
    const { asOwner } = await setup();
    const role = await createRole(asOwner, 'MKT', {
      name: 'No dashboards',
      permissions: { dashboards: { read: false } },
    });
    expect(role.status).toBe(201);
    const tools = await toolsFor(asOwner, [], role.data!.id);
    expect(await run(tools, 'get_project_activity')).toMatchObject({ error: expect.anything() });
  });

  it('reaches the real route: a create lands in the project, authored by the agent', async () => {
    const { asOwner } = await setup();
    const view = await asOwner.projects({ projectKey: 'MKT' }).get();
    const columnId = view.data?.columns[0]?.id;
    if (columnId === undefined) throw new Error('Test project has no columns');
    const tools = await toolsFor(asOwner, ['create_issue']);

    const created = await run(tools, 'create_issue', { columnId, title: 'Prepare launch' });
    expect(created).toMatchObject({ title: 'Prepare launch' });

    // The issue is really there, read back through the API.
    const found = await asOwner.projects({ projectKey: 'MKT' }).issues.search.get({ query: {} });
    expect(found.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ title: 'Prepare launch' })]),
    );
  });

  it('binds projectKey: it is not asked of the model and cannot be redirected', async () => {
    const { asOwner } = await setup();
    await createProject(asOwner, { key: 'OPS', name: 'Operations' });
    const view = await asOwner.projects({ projectKey: 'MKT' }).get();
    const columnId = view.data?.columns[0]?.id;
    if (columnId === undefined) throw new Error('Test project has no columns');
    const tools = await toolsFor(asOwner, ['create_issue']);

    // The argument the agent's project supplies is not part of the tool's schema.
    const schema = tools.create_issue?.inputSchema as unknown as {
      getJsonSchema(): { properties: Record<string, unknown> };
    };
    expect(Object.keys(schema.getJsonSchema().properties)).not.toContain('projectKey');

    // Naming another project in the arguments does not move the write there.
    await run(tools, 'create_issue', { columnId, title: 'Stray', projectKey: 'OPS' });
    const ops = await asOwner.projects({ projectKey: 'OPS' }).issues.search.get({ query: {} });
    expect(ops.data).toEqual([]);
    const mkt = await asOwner.projects({ projectKey: 'MKT' }).issues.search.get({ query: {} });
    expect(mkt.data).toEqual([expect.objectContaining({ title: 'Stray' })]);
  });

  it('hides visibility on note boards: the agent only creates boards the project sees', async () => {
    const { asOwner } = await setup();
    const tools = await toolsFor(asOwner, ['create_note_board']);

    const schema = tools.create_note_board?.inputSchema as unknown as {
      getJsonSchema(): { properties: Record<string, unknown> };
    };
    expect(Object.keys(schema.getJsonSchema().properties)).not.toContain('visibility');

    // Asking for it anyway does not make the board the agent's own.
    await run(tools, 'create_note_board', { name: 'Ideas', visibility: 'private' });
    const boards = await asOwner.projects({ projectKey: 'MKT' })['note-boards'].get({ query: {} });
    expect(boards.data).toEqual([expect.objectContaining({ name: 'Ideas', ownerUserId: null })]);
  });

  it('carries the board read with the board update, which replaces the canvas whole', async () => {
    const { asOwner } = await setup();
    const tools = await toolsFor(asOwner, ['update_note_board']);

    expect(tools.get_note_board).toBeDefined();
    // The read comes with the update, not with any other note board action.
    expect((await toolsFor(asOwner, ['create_note_board'])).get_note_board).toBeUndefined();
  });

  // A hidden argument names a field of the route's own schema. Renaming the field
  // there would leave the catalog hiding something that no longer exists, and the
  // agent would silently get the argument back.
  it('hides only arguments the routes actually take', () => {
    const table = new Map(routeTools(getMcpApp()).map((route) => [route.name, route]));
    const hidden = [...AGENT_ACTIONS, ...ALWAYS_ON_ACTIONS].flatMap((tool) =>
      (tool.overrides?.hide ?? []).map((name) => ({ key: tool.key, name })),
    );
    expect(hidden.length).toBeGreaterThan(0);

    for (const { key, name } of hidden) {
      expect(Object.keys(table.get(key)?.inputSchema.properties ?? {})).toContain(name);
    }
  });

  // The catalog states which role an action needs, which it can only do when it
  // carries the permission the route behind the action asserts.
  it('reports the permission of the route behind each action', () => {
    const catalog = new Map(actionCatalog().map((action) => [action.key, action.permission]));

    // A route guarded by the permission macro, and one guarded by an entity guard,
    // which names the action alone.
    expect(catalog.get('create_issue')).toEqual(['work_items', 'create']);
    expect(catalog.get('update_issue')).toEqual(['work_items', 'edit']);
    // Asserts its permission in the handler and states the same pair in its detail.
    expect(catalog.get('get_issue')).toEqual(['work_items', 'read']);

    // Everything else has one. prepare_issue_import and get_current_date have no
    // route; charts and the project itself are open to any member of the project.
    expect([...catalog].filter(([, permission]) => !permission).map(([key]) => key)).toEqual([
      'prepare_issue_import',
      'create_chart',
      'get_current_date',
      'get_project',
    ]);
  });

  it("provisions a legacy agent's key once, even when two runs start together", async () => {
    const { asOwner, teamId } = await setup();
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Legacy Bot',
      username: 'legacy',
      kind: 'internal',
    });
    const agentId = created.data?.agent.id;
    const project = await getProjectByRef('MKT', '');
    if (agentId === undefined || !project) throw new Error('Test agent was not created');

    // An agent from before the key existed: no stored secret, and no place in the
    // team's member list.
    await db
      .update(aiAgent)
      .set({ apiKeyCiphertext: null, apiKeyIv: null, apiKeyAuthTag: null })
      .where(eq(aiAgent.id, agentId));
    await db.delete(apikey).where(eq(apikey.referenceId, created.data!.agent.userId));
    await db.delete(teamMember).where(eq(teamMember.userId, created.data!.agent.userId));

    const agent = await getAgentById(agentId, teamId);
    if (!agent) throw new Error('Test agent was not found');

    // Two runs of the same agent race to provision it.
    const [first, second] = await Promise.all([
      getInternalAgentApiKey(agent),
      getInternalAgentApiKey(agent),
    ]);

    // Both runs get the same key, and the bot user ends with exactly one key row —
    // a second would revoke a key already in use and list the agent twice.
    expect(first).toBe(second);
    const keys = await db.select().from(apikey).where(eq(apikey.referenceId, agent.userId));
    expect(keys).toHaveLength(1);

    // The listing still shows the agent once, and the key works against a real route.
    const listed = await agents(asOwner, teamId).get();
    expect(listed.data?.filter((a) => a.id === agentId)).toHaveLength(1);
    const tools = buildRouteTools(project, first, agent.tools);
    expect(await run(tools, 'get_project')).toMatchObject({ columns: expect.any(Array) });
  });

  it('appends a checklist batch through the granted route tool', async () => {
    const { asOwner } = await setup();
    const view = await asOwner.projects({ projectKey: 'MKT' }).get();
    const issue = await asOwner.projects({ projectKey: 'MKT' }).issues.post({
      columnId: view.data!.columns[0].id,
      title: 'Release',
    });
    const checklist = await asOwner
      .issues({ issueId: issue.data!.id })
      .checklists.post({ title: 'Steps' });
    const tools = await toolsFor(asOwner, ['create_checklist_items']);
    const items = [{ content: 'Tag release' }, { content: 'Publish notes' }];
    expect(
      await run(tools, 'create_checklist_items', { checklistId: checklist.data!.id, items }),
    ).toMatchObject(items);
    const read = await asOwner.issues({ issueId: issue.data!.id }).get();
    expect(read.data!.checklists[0].items).toMatchObject(items);
  });

  it('denies a checklist batch when the agent role cannot edit work items', async () => {
    const { asOwner } = await setup();
    const view = await asOwner.projects({ projectKey: 'MKT' }).get();
    const issue = await asOwner.projects({ projectKey: 'MKT' }).issues.post({
      columnId: view.data!.columns[0].id,
      title: 'Release',
    });
    const checklist = await asOwner
      .issues({ issueId: issue.data!.id })
      .checklists.post({ title: 'Steps' });
    const role = await createRole(asOwner, 'MKT', {
      name: 'Read only',
      permissions: { work_items: { read: true, edit: false } },
    });
    const tools = await toolsFor(asOwner, ['create_checklist_items'], role.data!.id);
    expect(
      await run(tools, 'create_checklist_items', {
        checklistId: checklist.data!.id,
        items: [{ content: 'Forbidden' }],
      }),
    ).toMatchObject({ error: expect.anything() });
    const read = await asOwner.issues({ issueId: issue.data!.id }).get();
    expect(read.data!.checklists[0].items).toEqual([]);
  });

  it("enforces the agent's role: a forbidden action returns the route's error", async () => {
    const { asOwner } = await setup();
    const view = await asOwner.projects({ projectKey: 'MKT' }).get();
    const columnId = view.data?.columns[0]?.id;
    if (columnId === undefined) throw new Error('Test project has no columns');

    // A role that may read work items but not create them.
    const role = await createRole(asOwner, 'MKT', {
      name: 'Read only',
      permissions: { work_items: { create: false, edit: false, read: true, delete: false } },
    });
    const roleId = role.data?.id;
    if (roleId === undefined) throw new Error('Test role was not created');

    // The action is granted on the agent, so it holds the tool...
    const tools = await toolsFor(asOwner, ['create_issue'], roleId);
    expect(tools.create_issue).toBeDefined();

    // ...but the role denies it, and the route's 403 comes back as a result the model
    // can read rather than aborting the run.
    const result = await run(tools, 'create_issue', { columnId, title: 'Denied' });
    expect(result).toMatchObject({ error: expect.anything() });

    const found = await asOwner.projects({ projectKey: 'MKT' }).issues.search.get({ query: {} });
    expect(found.data).toEqual([]);

    // A read the role does allow still works.
    const context = await run(tools, 'get_project');
    expect(context).toMatchObject({ columns: expect.any(Array) });
  });
});

// A run works in one project, and its tools are bound to it: an object addressed by id
// that belongs to another project of the agent is refused, although the agent's bot
// is a member there. Without the bound, whoever may start a run in MKT could make the
// agent read and write OPS.
describe('internal agent route tools are bound to the run project', () => {
  beforeEach(async () => {
    await resetDb();
  });

  // An agent that works in MKT and OPS, its tools built for a run in MKT, and an issue
  // of each project.
  async function crossProject(tools: string[]) {
    const { asOwner, teamId } = await setup();
    await createProject(asOwner, { key: 'OPS', name: 'Operations' });
    const issueIn = async (projectKey: string, title: string) => {
      const view = await asOwner.projects({ projectKey }).get();
      const issue = await asOwner
        .projects({ projectKey })
        .issues.post({ columnId: view.data!.columns[0]!.id, title });
      return issue.data!.id;
    };
    const mktIssue = await issueIn('MKT', 'Marketing plan');
    const opsIssue = await issueIn('OPS', 'Pager rota');
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Triage Bot',
      username: `triage-${++agentSeq}`,
      kind: 'internal',
      tools,
      projectIds: [await projectIdOf(asOwner, 'MKT'), await projectIdOf(asOwner, 'OPS')],
    });
    const project = await getProjectByRef('MKT', '');
    if (!project) throw new Error('Test project was not created');
    const agent = await getAgentById(created.data!.agent.id, teamId);
    if (!agent) throw new Error('Test agent was not found');
    const built = buildRouteTools(project, await getInternalAgentApiKey(agent), agent.tools);
    return { asOwner, tools: built, mktIssue, opsIssue };
  }

  const outside = { error: { error: 'Outside the project this run works in' } };

  it('refuses reading an issue of another project', async () => {
    const { tools, mktIssue, opsIssue } = await crossProject([]);

    expect(await run(tools, 'get_issue', { issueId: opsIssue })).toEqual(outside);
    expect(await run(tools, 'list_issue_activity', { issueId: opsIssue })).toEqual(outside);
    expect(await run(tools, 'get_issue', { issueId: mktIssue })).toMatchObject({
      title: 'Marketing plan',
    });
  });

  it('refuses writing to an issue of another project', async () => {
    const { asOwner, tools, mktIssue, opsIssue } = await crossProject([
      'add_comment',
      'update_issue',
    ]);

    expect(await run(tools, 'add_comment', { issueId: opsIssue, body: 'From MKT' })).toEqual(
      outside,
    );
    expect(await run(tools, 'update_issue', { issueId: opsIssue, title: 'Renamed' })).toEqual(
      outside,
    );
    expect((await asOwner.issues({ issueId: opsIssue }).get()).data).toMatchObject({
      title: 'Pager rota',
    });
    expect(await run(tools, 'add_comment', { issueId: mktIssue, body: 'Here' })).toMatchObject({
      body: 'Here',
    });
  });

  it('refuses a checklist of an issue of another project', async () => {
    const { asOwner, tools, opsIssue } = await crossProject([
      'create_checklist_item',
      'create_checklist_items',
    ]);
    const checklist = await asOwner
      .issues({ issueId: opsIssue })
      .checklists.post({ title: 'Steps' });

    expect(
      await run(tools, 'create_checklist_item', { checklistId: checklist.data!.id, content: 'x' }),
    ).toEqual(outside);
    expect(
      await run(tools, 'create_checklist_items', {
        checklistId: checklist.data!.id,
        items: [{ content: 'Forbidden' }],
      }),
    ).toEqual(outside);
    const read = await asOwner.issues({ issueId: opsIssue }).get();
    expect(read.data!.checklists[0].items).toEqual([]);
  });

  it('refuses a cycle and an initiative of another project', async () => {
    const { asOwner, tools } = await crossProject(['update_cycle', 'update_initiative']);
    const today = new Date().toISOString().slice(0, 10);
    const cycle = await asOwner
      .projects({ projectKey: 'OPS' })
      .cycles.post({ name: 'Sprint 1', startDate: today, endDate: today });
    const initiative = await asOwner
      .projects({ projectKey: 'OPS' })
      .initiatives.post({ title: 'Uptime' });

    expect(await run(tools, 'get_cycle', { cycleId: cycle.data!.id })).toEqual(outside);
    expect(await run(tools, 'update_cycle', { cycleId: cycle.data!.id, name: 'x' })).toEqual(
      outside,
    );
    expect(await run(tools, 'get_initiative', { initiativeId: initiative.data!.id })).toEqual(
      outside,
    );
    expect(
      await run(tools, 'update_initiative', { initiativeId: initiative.data!.id, title: 'x' }),
    ).toEqual(outside);
  });

  it('refuses any request bound to another project, and ignores a malformed bound', async () => {
    const { owner, asOwner } = await setup();
    await createProject(asOwner, { key: 'OPS', name: 'Operations' });
    const view = await asOwner.projects({ projectKey: 'OPS' }).get();
    const issue = await asOwner
      .projects({ projectKey: 'OPS' })
      .issues.post({ columnId: view.data!.columns[0]!.id, title: 'Pager rota' });
    const issueId = issue.data!.id;
    const mkt = String(await projectIdOf(asOwner, 'MKT'));
    const ops = String(await projectIdOf(asOwner, 'OPS'));
    const read = (bound: string) =>
      authedApi(owner.cookie, { 'x-agent-project': bound }).issues({ issueId }).get();

    const refused = await read(mkt);
    expect(refused.status).toBe(403);
    expect(refused.error!.value).toMatchObject({ error: 'Outside the project this run works in' });
    expect((await read(ops)).status).toBe(200);
    expect((await read('MKT')).status).toBe(200);
  });

  it('leaves a person reading the same issue alone', async () => {
    const { asOwner, opsIssue } = await crossProject([]);

    expect((await asOwner.issues({ issueId: opsIssue }).get()).status).toBe(200);
  });
});
