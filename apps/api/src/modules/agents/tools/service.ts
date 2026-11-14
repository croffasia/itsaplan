import { db, agentTool, agentToolLink, integrationCredential } from '@repo/db';
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { getTool, integrationDescriptors, type ToolConfig } from '@repo/agent-tools';
import { iso, HttpError, rethrowDuplicate } from '#shared/lib';
import { decryptSecret } from '@repo/crypto';
import { getCredentialById } from '../integrations/service';
import { sourceKeyOf, toolSource, type SourceTool, type ToolCall } from './extension';

// Data access for configured tools, shared by every project the team owns. A
// configured tool binds a catalog tool (tool_key) to one integration_credential of the
// team, or to none when its integration needs no credential, or is a tool an extension
// defines (./extension.ts). The secret lives on the credential, so a row here carries no
// secret; the runtime decrypts the bound credential at call time. The list DTO names
// each row and adds its integration and its credential's label for display.

export interface AgentToolRow {
  id: number;
  teamId: number;
  toolKey: string;
  credentialId: number | null;
  integrationKey: string;
  credentialLabel: string | null;
  label: string;
  description: string | null;
  // The extension that defines it, null for a catalog tool.
  source: string | null;
  // False for a tool the instance does not have: its integration or its source is gone.
  supported: boolean;
  createdAt: string;
}

const dtoColumns = {
  id: agentTool.id,
  teamId: agentTool.teamId,
  toolKey: agentTool.toolKey,
  credentialId: agentTool.credentialId,
  credentialIntegrationKey: integrationCredential.integrationKey,
  credentialLabel: integrationCredential.label,
  createdAt: agentTool.createdAt,
};

type StoredRow = {
  id: number;
  teamId: number;
  toolKey: string;
  credentialId: number | null;
  credentialIntegrationKey: string | null;
  credentialLabel: string | null;
  createdAt: Date;
};

// The tools a source defines among the rows of one team.
async function sourceTools(
  teamId: number,
  rows: { id: number; toolKey: string }[],
): Promise<Map<number, SourceTool>> {
  const source = toolSource();
  const own = source ? rows.filter((r) => sourceKeyOf(r.toolKey) === source.key) : [];
  if (!source || own.length === 0) return new Map();
  return source.tools(teamId, own);
}

// A row the catalog does not know and no source defines keeps its key as its name. A
// catalog tool bound to no credential takes its integration from the catalog.
async function describeRows(teamId: number, rows: StoredRow[]): Promise<AgentToolRow[]> {
  const defined = await sourceTools(teamId, rows);
  return rows.map(({ credentialIntegrationKey, ...row }) => {
    const catalog = getTool(row.toolKey);
    const sourced = defined.get(row.id);
    return {
      ...row,
      integrationKey: credentialIntegrationKey ?? catalog?.integration.key ?? '',
      label: catalog?.tool.label ?? sourced?.label ?? row.toolKey,
      description: catalog?.tool.description ?? sourced?.description ?? null,
      source: catalog ? null : sourceKeyOf(row.toolKey),
      supported: !!catalog || !!sourced?.supported,
      createdAt: iso(row.createdAt),
    };
  });
}

function selectTools() {
  return db
    .select(dtoColumns)
    .from(agentTool)
    .leftJoin(integrationCredential, eq(integrationCredential.id, agentTool.credentialId));
}

// Names are stored in the catalog, not in the table, so a search resolves to tool keys.
function toolKeysMatching(search: string): string[] {
  const q = search.toLowerCase();
  return integrationDescriptors().flatMap((i) =>
    i.tools
      .filter((tool) => [tool.label, tool.group, i.label].some((s) => s?.toLowerCase().includes(q)))
      .map((tool) => tool.key),
  );
}

// The tools of a group: an integration's catalog tools, or the tools a source defines.
function inGroup(group: string) {
  const integration = integrationDescriptors().find((i) => i.key === group);
  return or(
    inArray(agentTool.toolKey, integration?.tools.map((tool) => tool.key) ?? []),
    sql`starts_with(${agentTool.toolKey}, ${`${group}:`})`,
  );
}

// One page of the team's configured tools, newest first, with how many match in all.
export async function listAgentTools(
  teamId: number,
  window: { limit: number; offset: number },
  filter: { search?: string; group?: string } = {},
): Promise<{ items: AgentToolRow[]; total: number }> {
  const term = filter.search?.trim();
  const matching = term
    ? [...toolKeysMatching(term), ...((await toolSource()?.search(teamId, term)) ?? [])]
    : null;
  const where = and(
    eq(agentTool.teamId, teamId),
    matching ? inArray(agentTool.toolKey, matching) : undefined,
    filter.group ? inGroup(filter.group) : undefined,
  );
  const [rows, counted] = await Promise.all([
    selectTools()
      .where(where)
      .orderBy(desc(agentTool.createdAt), desc(agentTool.id))
      .limit(window.limit)
      .offset(window.offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(agentTool)
      .where(where),
  ]);
  return { items: await describeRows(teamId, rows), total: counted[0]?.count ?? 0 };
}

// The whole list, by tool key. What the picker that enables tools on an agent and the
// dialog that adds one read.
export async function listAgentToolOptions(teamId: number): Promise<AgentToolRow[]> {
  const rows = await selectTools().where(eq(agentTool.teamId, teamId)).orderBy(agentTool.toolKey);
  return describeRows(teamId, rows);
}

async function getAgentToolById(id: number, teamId: number): Promise<AgentToolRow | null> {
  const rows = await selectTools().where(and(eq(agentTool.id, id), eq(agentTool.teamId, teamId)));
  return rows[0] ? (await describeRows(teamId, rows))[0] : null;
}

export interface NewAgentToolInput {
  toolKey: string;
  credentialId?: number;
}

export async function createAgentTool(
  teamId: number,
  input: NewAgentToolInput,
): Promise<AgentToolRow> {
  const tool = getTool(input.toolKey);
  if (!tool) throw new HttpError(400, `Unknown tool: ${input.toolKey}`);
  const credentialId = input.credentialId ?? null;
  const { integration } = tool;
  if (credentialId === null) {
    if (integration.credentialSchema.length > 0 && !integration.credentialOptional) {
      throw new HttpError(400, `This tool needs a ${integration.label} credential.`);
    }
  } else if (integration.credentialSchema.length === 0) {
    throw new HttpError(400, `${integration.label} tools take no credential.`);
  } else {
    const credential = await getCredentialById(credentialId, teamId);
    if (!credential) throw new HttpError(400, 'Credential not found');
    if (credential.integrationKey !== integration.key) {
      throw new HttpError(
        400,
        `This tool needs a ${integration.label} credential, not ${credential.integrationKey}.`,
      );
    }
  }
  try {
    const [row] = await db
      .insert(agentTool)
      .values({ teamId, toolKey: input.toolKey, credentialId })
      .returning({ id: agentTool.id });
    return (await getAgentToolById(row.id, teamId))!;
  } catch (err) {
    rethrowDuplicate(err, 'This tool on this credential');
    throw err;
  }
}

export async function deleteAgentTool(id: number, teamId: number): Promise<boolean> {
  const deleted = await db
    .delete(agentTool)
    .where(and(eq(agentTool.id, id), eq(agentTool.teamId, teamId)))
    .returning({ id: agentTool.id });
  return deleted.length > 0;
}

// The configured tools enabled on an agent of the team, as DTOs (no secret). Used by the
// agent editor.
export async function listAgentToolLinks(agentId: number, teamId: number): Promise<AgentToolRow[]> {
  const rows = await db
    .select(dtoColumns)
    .from(agentToolLink)
    .innerJoin(agentTool, eq(agentTool.id, agentToolLink.agentToolId))
    .leftJoin(integrationCredential, eq(integrationCredential.id, agentTool.credentialId))
    .where(eq(agentToolLink.agentId, agentId))
    .orderBy(agentTool.toolKey);
  return describeRows(teamId, rows);
}

// The decrypted tools enabled on an agent: each tool's key and its bound credential.
// Not exposed over HTTP.
export async function listAgentToolsForRun(
  agentId: number,
): Promise<{ id: number; toolKey: string; credential: ToolConfig }[]> {
  const rows = await db
    .select({
      id: agentTool.id,
      toolKey: agentTool.toolKey,
      ciphertext: integrationCredential.ciphertext,
      iv: integrationCredential.iv,
      authTag: integrationCredential.authTag,
    })
    .from(agentToolLink)
    .innerJoin(agentTool, eq(agentTool.id, agentToolLink.agentToolId))
    .leftJoin(integrationCredential, eq(integrationCredential.id, agentTool.credentialId))
    .where(eq(agentToolLink.agentId, agentId))
    .orderBy(agentTool.id);
  return rows.map(({ id, toolKey, ciphertext, iv, authTag }) => ({
    id,
    toolKey,
    credential:
      ciphertext && iv && authTag
        ? (JSON.parse(decryptSecret({ ciphertext, iv, authTag })) as ToolConfig)
        : {},
  }));
}

// A configured tool an agent can call, with its credential bound.
export interface RunnableTool {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  run: (input: Record<string, unknown>) => Promise<unknown>;
}

// The tools enabled on an agent that the instance can run, for its runs and chat answers
// and for an external agent over MCP, with the run it works in or the MCP request it called
// them in. A tool enabled more than once, bound to different credentials, takes the
// configured tool's id after its name on each copy.
export async function agentToolSet(
  agent: { id: number; teamId: number },
  context: Pick<ToolCall, 'runId' | 'request'> = {},
): Promise<RunnableTool[]> {
  const rows = await listAgentToolsForRun(agent.id);
  const defined = await sourceTools(agent.teamId, rows);
  const tools: { id: number; tool: RunnableTool }[] = [];
  const add = (id: number, tool: RunnableTool) => tools.push({ id, tool });
  for (const row of rows) {
    const catalog = getTool(row.toolKey);
    const sourced = defined.get(row.id);
    if (catalog) {
      add(row.id, {
        name: catalog.tool.key,
        description: catalog.tool.description,
        inputSchema: catalog.tool.inputSchema,
        run: (input) => catalog.tool.execute(row.credential, input),
      });
    } else if (sourced?.supported) {
      add(row.id, {
        name: sourced.name,
        description: sourced.description,
        inputSchema: sourced.inputSchema,
        run: (input) =>
          sourced.execute(input, {
            ...context,
            agentId: agent.id,
            teamId: agent.teamId,
            credential: row.credential,
          }),
      });
    }
  }
  const counts = new Map<string, number>();
  for (const { tool } of tools) counts.set(tool.name, (counts.get(tool.name) ?? 0) + 1);
  // A suffixed name can be one another tool has: the later of the two is left out.
  const used = new Set<string>();
  return tools.flatMap(({ id, tool }) => {
    const name = counts.get(tool.name)! > 1 ? `${tool.name}_${id}` : tool.name;
    if (used.has(name)) return [];
    used.add(name);
    return [{ ...tool, name }];
  });
}

// Unknown ids and ids from another team are ignored, not rejected.
export async function setAgentTools(
  agentId: number,
  teamId: number,
  agentToolIds: number[],
): Promise<void> {
  const unique = [...new Set(agentToolIds)];
  const valid =
    unique.length === 0
      ? []
      : (
          await db
            .select({ id: agentTool.id })
            .from(agentTool)
            .where(and(eq(agentTool.teamId, teamId), inArray(agentTool.id, unique)))
        ).map((r) => r.id);

  await db.transaction(async (tx) => {
    await tx.delete(agentToolLink).where(eq(agentToolLink.agentId, agentId));
    if (valid.length > 0) {
      await tx.insert(agentToolLink).values(valid.map((agentToolId) => ({ agentId, agentToolId })));
    }
  });
}
