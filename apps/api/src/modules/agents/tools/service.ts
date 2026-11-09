import { db, agentTool, agentToolLink, integrationCredential } from '@repo/db';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { getTool, type ToolConfig } from '@repo/agent-tools';
import { iso, HttpError, rethrowDuplicate } from '#shared/lib';
import { decryptSecret } from '@repo/crypto';
import { getCredentialById } from '../integrations/service';

// Data access for configured tools, shared by every project the team owns. A
// configured tool binds a catalog tool (tool_key) to one integration_credential of the
// team, or to none when its integration needs no credential. The secret lives on the
// credential, so a row here carries no secret; the runtime decrypts the bound
// credential at call time. The list DTO enriches a row with its integration and its
// credential's label for display.

export interface AgentToolRow {
  id: number;
  teamId: number;
  toolKey: string;
  credentialId: number | null;
  integrationKey: string;
  credentialLabel: string | null;
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

// A tool bound to no credential takes its integration from the catalog.
function mapRow({
  credentialIntegrationKey,
  ...row
}: Omit<AgentToolRow, 'integrationKey' | 'createdAt'> & {
  credentialIntegrationKey: string | null;
  createdAt: Date;
}): AgentToolRow {
  return {
    ...row,
    integrationKey: credentialIntegrationKey ?? getTool(row.toolKey)?.integration.key ?? '',
    createdAt: iso(row.createdAt),
  };
}

function selectTools() {
  return db
    .select(dtoColumns)
    .from(agentTool)
    .leftJoin(integrationCredential, eq(integrationCredential.id, agentTool.credentialId));
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
  credentialId?: number;
}

export async function createAgentTool(
  teamId: number,
  input: NewAgentToolInput,
): Promise<AgentToolRow> {
  const tool = getTool(input.toolKey);
  if (!tool) throw new HttpError(400, `Unknown tool: ${input.toolKey}`);
  const credentialId = input.credentialId ?? null;
  if (tool.integration.credentialSchema.length === 0) {
    if (credentialId !== null) {
      throw new HttpError(400, `${tool.integration.label} tools take no credential.`);
    }
  } else if (credentialId === null) {
    throw new HttpError(400, `This tool needs a ${tool.integration.label} credential.`);
  } else {
    const credential = await getCredentialById(credentialId, teamId);
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

// The configured tools enabled on an agent, as DTOs (no secret). Used by the agent
// editor.
export async function listAgentToolLinks(agentId: number): Promise<AgentToolRow[]> {
  const rows = await db
    .select(dtoColumns)
    .from(agentToolLink)
    .innerJoin(agentTool, eq(agentTool.id, agentToolLink.agentToolId))
    .leftJoin(integrationCredential, eq(integrationCredential.id, agentTool.credentialId))
    .where(eq(agentToolLink.agentId, agentId))
    .orderBy(agentTool.toolKey);
  return rows.map(mapRow);
}

// The decrypted tools enabled on an agent, for the runtime to build tools: each tool's
// key and its bound credential. Not exposed over HTTP.
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
    .where(eq(agentToolLink.agentId, agentId));
  return rows.map(({ id, toolKey, ciphertext, iv, authTag }) => ({
    id,
    toolKey,
    credential:
      ciphertext && iv && authTag
        ? (JSON.parse(decryptSecret({ ciphertext, iv, authTag })) as ToolConfig)
        : {},
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
