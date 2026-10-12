import { describe, it, expect, beforeEach } from 'bun:test';
import { SpanType } from '@mastra/core/observability';
import { authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createAgent, projectIdOf, teamOf } from '#tests/helpers/agents';
import { createRole } from '#tests/helpers/roles';
import { addProjectMember } from '#tests/helpers/members';
import { getStore } from '../../../core/runtime/store';

// The model prices of a workspace, /workspaces/:workspaceId/model-prices, and the cost
// the agent dashboards read with them. Calls are seeded as the exporter writes them: a
// root span for the run with the metadata the dashboards scope on, and below it one
// model call per model.

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  const teamId = await teamOf(asOwner, 'MKT');
  const agent = await createAgent(asOwner, 'MKT', {
    name: 'Scout',
    username: 'scout',
    kind: 'internal',
  });
  const meta = {
    agentId: agent.data!.agent.id,
    teamId,
    projectId: await projectIdOf(asOwner, 'MKT'),
  };
  const workspaceId = (await asOwner.workspaces.get()).data!.find((w) => w.role === 'owner')!.id;
  return { asOwner, teamId, workspaceId, meta };
}

let nextId = 0;
const spanId = () => `price-span-${++nextId}`;

async function seedCall(
  meta: Record<string, unknown>,
  provider: string,
  model: string,
  usage: { inputTokens: number; outputTokens: number },
): Promise<void> {
  await getStore().init();
  const store = (await getStore().getStore('observability'))!;
  const traceId = spanId();
  const root = spanId();
  const startedAt = new Date(Date.now() - 60 * 60 * 1000);
  const endedAt = new Date(startedAt.getTime() + 1000);
  await store.createSpan({
    span: {
      traceId,
      spanId: root,
      name: 'agent run',
      spanType: SpanType.AGENT_RUN,
      isEvent: false,
      startedAt,
      endedAt,
      metadata: meta,
    },
  });
  await store.createSpan({
    span: {
      traceId,
      spanId: spanId(),
      parentSpanId: root,
      name: 'inference: 0',
      spanType: SpanType.MODEL_INFERENCE,
      isEvent: false,
      startedAt,
      endedAt,
      attributes: { provider, model, usage },
    },
  });
}

const prices = (api: Api, workspaceId: number) => api.workspaces({ workspaceId })['model-prices'];
const workspaceCost = async (api: Api, workspaceId: number) =>
  (await api.workspaces({ workspaceId })['agent-analytics'].get({ query: { days: 30 } })).data!
    .totals.cost;
const teamCost = async (api: Api, teamId: number) =>
  (await api.teams({ teamId })['agent-analytics'].get({ query: { days: 30 } })).data!.totals.cost;

const MILLION = { inputTokens: 1_000_000, outputTokens: 1_000_000 };

describe('model prices', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('lists the models the workspace called, those no price covers first', async () => {
    const { asOwner, workspaceId, meta } = await setup();
    await seedCall(meta, 'openai', 'gpt-5-mini', MILLION);
    await seedCall(meta, 'openai', 'gpt-5-mini', MILLION);
    await seedCall(meta, 'openai-compatible', 'qwen2.5-coder-32b', MILLION);

    const res = await prices(asOwner, workspaceId).used.get();
    expect(res.status).toBe(200);
    expect(res.data).toEqual([
      {
        provider: 'openai-compatible',
        model: 'qwen2.5-coder-32b',
        calls: 1,
        builtIn: null,
        own: null,
      },
      {
        provider: 'openai',
        model: 'gpt-5-mini',
        calls: 2,
        builtIn: { input: 0.25, output: 2, cacheRead: 0.025, cacheWrite: null },
        own: null,
      },
    ]);
  });

  it('costs every dashboard of the workspace with the price it set, until it is removed', async () => {
    const { asOwner, teamId, workspaceId, meta } = await setup();
    await seedCall(meta, 'openai-compatible', 'Qwen2.5-Coder-32B', MILLION);
    expect(await workspaceCost(asOwner, workspaceId)).toBeNull();

    const set = await prices(asOwner, workspaceId).put({
      provider: 'openai-compatible',
      model: 'qwen2.5-coder-32b',
      input: 0.2,
      output: 0.6,
    });
    expect(set.status).toBe(200);
    expect(set.data).toMatchObject({ model: 'qwen2.5-coder-32b', cacheRead: null });
    expect(await workspaceCost(asOwner, workspaceId)).toBeCloseTo(0.8, 6);
    expect(await teamCost(asOwner, teamId)).toBeCloseTo(0.8, 6);

    // Setting it again replaces the price rather than adding a second one.
    await prices(asOwner, workspaceId).put({
      provider: 'openai-compatible',
      model: 'qwen2.5-coder-32b',
      input: 1,
      output: 1,
    });
    expect(await workspaceCost(asOwner, workspaceId)).toBeCloseTo(2, 6);
    const used = (await prices(asOwner, workspaceId).used.get()).data!;
    expect(used).toHaveLength(1);
    expect(used[0]!.own).toMatchObject({ input: 1, output: 1 });

    const removed = await prices(asOwner, workspaceId)({ priceId: set.data!.id }).delete();
    expect(removed.status).toBe(204);
    expect(await workspaceCost(asOwner, workspaceId)).toBeNull();
  });

  it('wins over the built-in price of a model the table lists', async () => {
    const { asOwner, workspaceId, meta } = await setup();
    await seedCall(meta, 'openai', 'gpt-5-mini', MILLION);
    // openai/gpt-5-mini: 0.25 in and 2 out per million.
    expect(await workspaceCost(asOwner, workspaceId)).toBeCloseTo(2.25, 6);

    await prices(asOwner, workspaceId).put({
      provider: 'openai',
      model: 'gpt-5-mini',
      input: 0.1,
      output: 1,
    });
    expect(await workspaceCost(asOwner, workspaceId)).toBeCloseTo(1.1, 6);
  });

  it('pages through the built-in prices with the workspace’s own beside them', async () => {
    const { asOwner, workspaceId } = await setup();
    await prices(asOwner, workspaceId).put({
      provider: 'openai',
      model: 'gpt-5-mini',
      input: 0.1,
      output: 1,
      cacheRead: 0.01,
    });

    const res = await prices(asOwner, workspaceId).catalog.get({
      query: { search: 'OpenAI/GPT-5-MINI', pageSize: 100 },
    });
    expect(res.status).toBe(200);
    const row = res.data!.items.find((item) => item.model === 'gpt-5-mini')!;
    expect(row.builtIn).toEqual({ input: 0.25, output: 2, cacheRead: 0.025, cacheWrite: null });
    expect(row.own).toMatchObject({ input: 0.1, output: 1, cacheRead: 0.01, cacheWrite: null });

    const page = await prices(asOwner, workspaceId).catalog.get({ query: { pageSize: 5 } });
    expect(page.data!.items).toHaveLength(5);
    expect(page.data!.total).toBeGreaterThan(1000);
  });

  it('keeps the prices to the workspace’s owner and admins', async () => {
    const { asOwner, workspaceId } = await setup();
    const role = await createRole(asOwner, 'MKT', {
      name: 'Spend watcher',
      permissions: { agent_usage: { read: true } },
    });
    const asMember = await addProjectMember(asOwner, 'MKT', role.data!.id);

    expect((await prices(asMember, workspaceId).used.get()).status).toBe(404);
    const set = await prices(asMember, workspaceId).put({
      provider: 'openai',
      model: 'gpt-5-mini',
      input: 0,
      output: 0,
    });
    expect(set.status).toBe(404);

    // A price of another workspace is not one to remove.
    const other = await signUpTestUser({ name: 'Other' });
    const asOther = authedApi(other.cookie);
    const otherWorkspaceId = (await asOther.workspaces.get()).data![0]!.id;
    const theirs = await prices(asOther, otherWorkspaceId).put({
      provider: 'openai',
      model: 'gpt-5-mini',
      input: 0,
      output: 0,
    });
    const res = await prices(asOwner, workspaceId)({ priceId: theirs.data!.id }).delete();
    expect(res.status).toBe(404);
  });

  it('turns down a negative price', async () => {
    const { asOwner, workspaceId } = await setup();
    const res = await prices(asOwner, workspaceId).put({
      provider: 'openai',
      model: 'gpt-5-mini',
      input: -1,
      output: 1,
    });
    expect(res.status).toBe(400);
  });
});
