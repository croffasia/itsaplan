import { beforeEach, describe, expect, it } from 'bun:test';
import { db, aiAgent, apikey, projectMember } from '@repo/db';
import { eq } from 'drizzle-orm';
import { authedApi, type Api } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';
import { getProjectByKey } from '../../../projects/store';
import { getAgentById, getInternalAgentApiKey } from '../../store';
import { buildRouteTools } from '../../runtime/tools/route-tools';

// The tools an internal agent runs with, built from the routes tagged mcpTool() and
// dispatched in process with the agent's own API key. What is asserted here is the
// wiring, not the routes themselves (each feature's own test covers those): which
// tools an agent gets, that a call reaches the real route as the agent, that the
// project is bound rather than supplied by the model, and that the agent's project
// role is enforced.

const agents = (api: Api) => api.projects({ projectKey: 'MKT' })['ai-agents'];

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  return { owner, asOwner };
}

// Builds the tool set of a freshly created internal agent, the way the runtime does.
async function toolsFor(asOwner: Api, tools: string[], roleId?: number) {
  const created = await agents(asOwner).post({
    name: 'Triage Bot',
    username: `triage-${tools.length}-${roleId ?? 'default'}`,
    kind: 'internal',
    tools,
    ...(roleId === undefined ? {} : { roleId }),
  });
  const agentId = created.data?.agent.id;
  if (agentId === undefined) throw new Error('Test agent was not created');
  const project = await getProjectByKey('MKT');
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
    await asOwner.projects.post({ key: 'OPS', name: 'Operations' });
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

  it("provisions a legacy agent's key once, even when two runs start together", async () => {
    const { asOwner } = await setup();
    const created = await agents(asOwner).post({
      name: 'Legacy Bot',
      username: 'legacy',
      kind: 'internal',
    });
    const agentId = created.data?.agent.id;
    const project = await getProjectByKey('MKT');
    if (agentId === undefined || !project) throw new Error('Test agent was not created');

    // An agent from before the key existed: no stored secret, no membership.
    await db
      .update(aiAgent)
      .set({ apiKeyCiphertext: null, apiKeyIv: null, apiKeyAuthTag: null })
      .where(eq(aiAgent.id, agentId));
    await db.delete(apikey).where(eq(apikey.referenceId, created.data!.agent.userId));
    await db.delete(projectMember).where(eq(projectMember.userId, created.data!.agent.userId));

    const agent = await getAgentById(agentId, project.id);
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
    const listed = await agents(asOwner).get();
    expect(listed.data?.filter((a) => a.id === agentId)).toHaveLength(1);
    const tools = buildRouteTools(project, first, agent.tools);
    expect(await run(tools, 'get_project')).toMatchObject({ columns: expect.any(Array) });
  });

  it("enforces the agent's project role: a forbidden action returns the route's error", async () => {
    const { asOwner } = await setup();
    const view = await asOwner.projects({ projectKey: 'MKT' }).get();
    const columnId = view.data?.columns[0]?.id;
    if (columnId === undefined) throw new Error('Test project has no columns');

    // A role that may read work items but not create them.
    const role = await asOwner.projects({ projectKey: 'MKT' }).roles.post({
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
