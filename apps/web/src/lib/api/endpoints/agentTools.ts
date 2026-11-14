import { request } from '@/lib/api/core/client';
import { pageQuery, type Page, type PageParams } from '@/lib/api/core/paging';

// A configured tool: a catalog tool (toolKey) bound to an integration credential, or
// to none when its integration needs no credential, or a tool an extension defines
// (`source`), named and enriched with its integration and the credential's label for
// display. (Distinct from AgentTool, which is a built-in
// capability tool in the agent's Actions list.)
export interface ConfiguredTool {
  id: number;
  teamId: number;
  toolKey: string;
  credentialId: number | null;
  integrationKey: string;
  credentialLabel: string | null;
  label: string;
  description: string | null;
  source: string | null;
  // False for a tool this instance does not have: no agent gets it.
  supported: boolean;
  createdAt: string;
}

export interface NewConfiguredToolInput {
  toolKey: string;
  credentialId?: number;
}

// What the tool list asks for: the window, a search over the tool name, its group and its
// integration, and one integration's tools or a source's (`group`).
export interface ConfiguredToolListParams extends PageParams {
  search?: string;
  group?: string;
}

// Configured tools: a team's tools bound to a credential, and the tools enabled on
// one agent. The tool catalog itself comes from the integrations catalog.
export const listConfiguredTools = (teamId: number, params: ConfiguredToolListParams) =>
  request<Page<ConfiguredTool>>(
    `/teams/${teamId}/agent-tools${pageQuery(params, { search: params.search, group: params.group })}`,
  );

// The whole list, which the agent editor's tool picker and the tool dialog need
// entire.
export const listConfiguredToolOptions = (teamId: number) =>
  request<ConfiguredTool[]>(`/teams/${teamId}/agent-tools/options`);

export const createConfiguredTool = (teamId: number, input: NewConfiguredToolInput) =>
  request<ConfiguredTool>(`/teams/${teamId}/agent-tools`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const deleteConfiguredTool = (teamId: number, agentToolId: number) =>
  request<void>(`/teams/${teamId}/agent-tools/${agentToolId}`, { method: 'DELETE' });

export const listAgentToolLinks = (teamId: number, agentId: number) =>
  request<ConfiguredTool[]>(`/teams/${teamId}/ai-agents/${agentId}/tool-configs`);

export const setAgentTools = (teamId: number, agentId: number, agentToolIds: number[]) =>
  request<ConfiguredTool[]>(`/teams/${teamId}/ai-agents/${agentId}/tool-configs`, {
    method: 'PUT',
    body: JSON.stringify({ agentToolIds }),
  });
