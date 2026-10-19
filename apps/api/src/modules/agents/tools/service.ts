import { db, agentTool, agentToolLink, integrationCredential } from '@repo/db';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { getTool, MCP_TOOL_PREFIX, type ToolConfig } from '@repo/agent-tools';
import { iso, HttpError, rethrowDuplicate } from '#shared/lib';
import { decryptSecret } from '@repo/crypto';
import { getCredentialById } from '../integrations/service';
import { listCredentialMcpTools } from '../integrations/mcp';

// Data access for configured tools, shared by every project the team owns. A
// configured tool binds a catalog tool (tool_key) to one integration_credential of the
// team. The secret lives on the credential, so a row here carries no secret; the
// runtime decrypts the bound credential at call time. The list DTO enriches a row with
// its credential's integration and label for display.

export interface AgentToolRow {
  id: number;
  teamId: number;
  toolKey: string;
  credentialId: number;
  integrationKey: string;
  credentialLabel: string | null;
  createdAt: string;
}

const dtoColumns = {
  id: agentTool.id,
  teamId: agentTool.teamId,
  toolKey: agentTool.toolKey,
  credentialId: agentTool.credentialId,
  integrationKey: integrationCredential.integrationKey,
  credentialLabel: integrationCredential.label,
  createdAt: agentTool.createdAt,
};

function mapRow(row: Omit<AgentToolRow, 'createdAt'> & { createdAt: Date }): AgentToolRow {
  return { ...row, createdAt: iso(row.createdAt) };
}

function selectTools() {
  return db
    .select(dtoColumns)
    .from(agentTool)
    .innerJoin(integrationCredential, eq(integrationCredential.id, agentTool.credentialId));
}

// One page of the team's configured tools, by tool key, with how many it holds in
// total.
export async function listAgentTools(
  teamId: number,
  window: { limit: number; offset: number },
): Promise<{ items: AgentToolRow[]; total: number }> {
  const where = eq(agentTool.teamId, teamId);
  const [rows, counted] = await Promise.all([
    selectTools().where(where).orderBy(agentTool.toolKey).limit(window.limit).offset(window.offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(agentTool)
      .where(where),
  ]);
  return { items: rows.map(mapRow), total: counted[0]?.count ?? 0 };
}

// The whole list, by tool key. What the picker that enables tools on an agent and the
// dialog that adds one read.
export async function listAgentToolOptions(teamId: number): Promise<AgentToolRow[]> {
  const rows = await selectTools().where(eq(agentTool.teamId, teamId)).orderBy(agentTool.toolKey);
  return rows.map(mapRow);
}

async function getAgentToolById(id: number, teamId: number): Promise<AgentToolRow | null> {
  const rows = await selectTools().where(and(eq(agentTool.id, id), eq(agentTool.teamId, teamId)));
  return rows[0] ? mapRow(rows[0]) : null;
}

export interface NewAgentToolInput {
  toolKey: string;
  credentialId: number;
}

export async function createAgentTool(
  teamId: number,
  input: NewAgentToolInput,
): Promise<AgentToolRow> {
  if (input.toolKey.startsWith(MCP_TOOL_PREFIX)) {
    const tools = await listCredentialMcpTools(input.credentialId, teamId);
    if (!tools) throw new HttpError(400, 'This tool needs an MCP server credential.');
    const name = input.toolKey.slice(MCP_TOOL_PREFIX.length);
    if (!tools.some((t) => t.name === name)) {
      throw new HttpError(400, `The MCP server offers no tool named ${name}.`);
    }
  } else {
    const tool = getTool(input.toolKey);
    if (!tool) throw new HttpError(400, `Unknown tool: ${input.toolKey}`);
    const credential = await getCredentialById(input.credentialId, teamId);
    if (!credential) throw new HttpError(400, 'Credential not found');
    if (credential.integrationKey !== tool.integration.key) {
      throw new HttpError(
        400,
        `This tool needs a ${tool.integration.label} credential, not ${credential.integrationKey}.`,
      );
    }
  }
  try {
    const [row] = await db
      .insert(agentTool)
      .values({ teamId, toolKey: input.toolKey, credentialId: input.credentialId })
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

// The configured tools enabled on an agent, as DTOs (no secret). Used by the agent
// editor.
export async function listAgentToolLinks(agentId: number): Promise<AgentToolRow[]> {
  const rows = await db
    .select(dtoColumns)
    .from(agentToolLink)
    .innerJoin(agentTool, eq(agentTool.id, agentToolLink.agentToolId))
    .innerJoin(integrationCredential, eq(integrationCredential.id, agentTool.credentialId))
    .where(eq(agentToolLink.agentId, agentId))
    .orderBy(agentTool.toolKey);
  return rows.map(mapRow);
}

// The decrypted tools enabled on an agent, for the runtime to build tools: each tool's
// key and its bound credential. Not exposed over HTTP.
export async function listAgentToolsForRun(
  agentId: number,
): Promise<{ id: number; toolKey: string; credentialId: number; credential: ToolConfig }[]> {
  const rows = await db
    .select({
      id: agentTool.id,
      toolKey: agentTool.toolKey,
      credentialId: agentTool.credentialId,
      ciphertext: integrationCredential.ciphertext,
      iv: integrationCredential.iv,
      authTag: integrationCredential.authTag,
    })
    .from(agentToolLink)
    .innerJoin(agentTool, eq(agentTool.id, agentToolLink.agentToolId))
    .innerJoin(integrationCredential, eq(integrationCredential.id, agentTool.credentialId))
    .where(eq(agentToolLink.agentId, agentId));
  return rows.map((r) => ({
    id: r.id,
    toolKey: r.toolKey,
    credentialId: r.credentialId,
    credential: JSON.parse(
      decryptSecret({ ciphertext: r.ciphertext, iv: r.iv, authTag: r.authTag }),
    ) as ToolConfig,
  }));
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
