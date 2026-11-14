import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { and, eq, like } from 'drizzle-orm';
import { db, agentTool } from '@repo/db';
import { authedApi, type Api, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createAgent } from '#tests/helpers/agents';
import { mcpAccessToken, mcpRpc } from '#tests/helpers/mcp';
import { setToolSource, type SourceTool, type ToolCall, type ToolSource } from '../../extension';
import { agentToolSet } from '../../service';

// A tool an extension defines is a configured tool keyed `<source>:...`: the core lists,
// enables and deletes it as a catalog tool, names it and runs it through its source, and
// keeps it, unsupported, once the source is gone.

let calls: { input: Record<string, unknown>; call: ToolCall }[] = [];
let supported = true;

// The name the model calls a tool by is its key after `echo:`.
function echo(toolKey: string): SourceTool {
  const name = toolKey.slice('echo:'.length);
  return {
    name,
    label: `Echo ${name}`,
    description: `Echo ${name} returns its text`,
    supported,
    inputSchema: z.object({ text: z.string() }),
    execute: async (input, call) => {
      calls.push({ input, call });
      return { echoed: input.text };
    },
  };
}

const source: ToolSource = {
  key: 'echo',
  tools: async (_teamId, rows) => new Map(rows.map((row) => [row.id, echo(row.toolKey)])),
  search: async (teamId, text) => {
    const rows = await db
      .select({ toolKey: agentTool.toolKey })
      .from(agentTool)
      .where(and(eq(agentTool.teamId, teamId), like(agentTool.toolKey, 'echo:%')));
    return rows
      .map((row) => row.toolKey)
      .filter((key) => echo(key).label.toLowerCase().includes(text.toLowerCase()));
  },
};

const tools = (api: Api, teamId: number) => api.teams({ teamId })['agent-tools'];

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  const project = await createProject(asOwner, { key: 'MKT', name: 'Marketing' });
  return { owner, asOwner, teamId: project.data!.teamId };
}

// No route creates a source's tool: its extension writes the row.
async function sourceTool(teamId: number, name: string): Promise<number> {
  const [row] = await db
    .insert(agentTool)
    .values({ teamId, toolKey: `echo:${name}` })
    .returning({ id: agentTool.id });
  return row.id;
}

async function agentWith(
  asOwner: Api,
  teamId: number,
  kind: 'internal' | 'external',
  ids: number[],
) {
  const created = await createAgent(asOwner, 'MKT', { name: 'Bot', username: 'bot', kind });
  const agent = created.data!.agent;
  await asOwner.teams({ teamId })['ai-agents']({ agentId: agent.id })['tool-configs'].put({
    agentToolIds: ids,
  });
  return { agent, apiKey: created.data!.apiKey };
}

describe('tools an extension defines', () => {
  beforeEach(async () => {
    await resetDb();
    calls = [];
    supported = true;
    setToolSource(source);
  });
  afterEach(() => setToolSource());

  it('lists a tool its source names, and finds it by that name', async () => {
    const { asOwner, teamId } = await setup();
    const id = await sourceTool(teamId, 'first');
    await sourceTool(teamId, 'second');

    const list = await tools(asOwner, teamId).get({ query: { search: 'echo fir' } });
    expect(list.data?.items).toEqual([
      expect.objectContaining({
        id,
        toolKey: 'echo:first',
        label: 'Echo first',
        description: 'Echo first returns its text',
        source: 'echo',
        supported: true,
      }),
    ]);
    const none = await tools(asOwner, teamId).get({ query: { search: 'nothing' } });
    expect(none.data?.total).toBe(0);
  });

  it('narrows the list to the tools its source defines', async () => {
    const { asOwner, teamId } = await setup();
    await sourceTool(teamId, 'first');
    await tools(asOwner, teamId).post({ toolKey: 'pdf_read' });

    const own = await tools(asOwner, teamId).get({ query: { group: 'echo' } });
    expect(own.data?.items.map((i) => i.toolKey)).toEqual(['echo:first']);
    const other = await tools(asOwner, teamId).get({ query: { group: 'ech' } });
    expect(other.data?.total).toBe(0);
  });

  it('keeps a tool whose source is gone, unsupported, and gives it to no agent', async () => {
    const { asOwner, teamId } = await setup();
    const id = await sourceTool(teamId, 'first');
    const { agent } = await agentWith(asOwner, teamId, 'internal', [id]);
    setToolSource();

    const list = await tools(asOwner, teamId).get();
    expect(list.data?.items).toEqual([
      expect.objectContaining({ label: 'echo:first', source: 'echo', supported: false }),
    ]);
    expect(await agentToolSet(agent)).toEqual([]);
  });

  it('gives no agent a tool its source cannot run here', async () => {
    const { asOwner, teamId } = await setup();
    const id = await sourceTool(teamId, 'first');
    const { agent } = await agentWith(asOwner, teamId, 'internal', [id]);
    supported = false;

    const options = await tools(asOwner, teamId).options.get();
    expect(options.data).toEqual([expect.objectContaining({ id, supported: false })]);
    expect(await agentToolSet(agent)).toEqual([]);
  });

  it('runs a tool with the agent, the team and the run it works in', async () => {
    const { asOwner, teamId } = await setup();
    const id = await sourceTool(teamId, 'first');
    const { agent } = await agentWith(asOwner, teamId, 'internal', [id]);

    const [tool] = await agentToolSet(agent, { runId: 7 });
    expect(tool.name).toBe('first');
    expect(await tool.run({ text: 'hi' })).toEqual({ echoed: 'hi' });
    expect(calls).toEqual([
      {
        input: { text: 'hi' },
        call: { agentId: agent.id, teamId, credential: {}, runId: 7 },
      },
    ]);
  });

  it('lists and runs an agent’s tools over MCP, and gives a person none', async () => {
    const { owner, asOwner, teamId } = await setup();
    const id = await sourceTool(teamId, 'first');
    const { apiKey } = await agentWith(asOwner, teamId, 'external', [id]);

    const { tools: listed } = await mcpRpc(apiKey!, 'tools/list');
    const tool = listed.find((t: { name: string }) => t.name === 'first');
    expect(tool).toMatchObject({
      description: 'Echo first returns its text',
      inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    });

    const ran = await mcpRpc(apiKey!, 'tools/call', { name: 'first', arguments: { text: 'hi' } });
    expect(ran.isError).toBeUndefined();
    expect(JSON.parse(ran.content[0].text)).toEqual({ echoed: 'hi' });
    expect(calls[0].call).toEqual({
      agentId: expect.any(Number),
      teamId,
      credential: {},
      request: expect.any(Request),
    });

    const wrong = await mcpRpc(apiKey!, 'tools/call', { name: 'first', arguments: { text: 1 } });
    expect(wrong.isError).toBe(true);
    expect(calls).toHaveLength(1);

    const asPerson = await mcpRpc(await mcpAccessToken(owner.cookie), 'tools/list');
    expect(asPerson.tools.some((t: { name: string }) => t.name === 'first')).toBe(false);
  });

  it('gives an agent of a team MCP is off for no tools over MCP', async () => {
    const { asOwner, teamId } = await setup();
    const id = await sourceTool(teamId, 'first');
    const { apiKey } = await agentWith(asOwner, teamId, 'external', [id]);
    await asOwner.teams({ teamId }).mcp.patch({ enabled: false });

    const { tools: listed } = await mcpRpc(apiKey!, 'tools/list');
    expect((listed ?? []).some((t: { name: string }) => t.name === 'first')).toBe(false);
    const ran = await mcpRpc(apiKey!, 'tools/call', { name: 'first', arguments: { text: 'hi' } });
    expect(ran?.isError ?? true).toBe(true);
    expect(calls).toEqual([]);
  });

  it('names each copy of a repeated name after its configured tool, and leaves out a clash', async () => {
    const { asOwner, teamId } = await setup();
    const own = await sourceTool(teamId, 'pdf_read');
    const catalog = (await tools(asOwner, teamId).post({ toolKey: 'pdf_read' })).data!.id;
    const clash = await sourceTool(teamId, `pdf_read_${catalog}`);
    const { agent } = await agentWith(asOwner, teamId, 'internal', [own, catalog, clash]);

    const set = await agentToolSet(agent);
    expect(set.map((tool) => tool.name)).toEqual([`pdf_read_${own}`, `pdf_read_${catalog}`]);
    expect(set[1].description).not.toContain('Echo');
  });

  it('leaves out a tool named as one of the core’s', async () => {
    const { asOwner, teamId } = await setup();
    const id = await sourceTool(teamId, 'create_issue');
    const { apiKey } = await agentWith(asOwner, teamId, 'external', [id]);

    const { tools: listed } = await mcpRpc(apiKey!, 'tools/list');
    const named = listed.filter((t: { name: string }) => t.name === 'create_issue');
    expect(named).toHaveLength(1);
    expect(named[0].description).not.toContain('Echo');
    expect(calls).toEqual([]);
  });
});
