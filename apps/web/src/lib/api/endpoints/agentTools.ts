import { request } from '@/lib/api/core/client';
import { pageQuery, type Page, type PageParams } from '@/lib/api/core/paging';

// A configured tool: a catalog tool (toolKey) bound to an integration credential,
// enriched with the credential's integration and label for display. (Distinct from
// AgentTool, which is a built-in capability tool in the agent's Actions list.)
export interface ConfiguredTool {
  id: number;
  teamId: number;
  toolKey: string;
  credentialId: number;
  integrationKey: string;
  credentialLabel: string | null;
  createdAt: string;
}

export interface NewConfiguredToolInput {
  toolKey: string;
  credentialId: number;
}

// Configured tools: a team's tools bound to a credential, and the tools enabled on
// one agent. The tool catalog itself comes from the integrations catalog.
export const listConfiguredTools = (teamId: number, params: PageParams) =>
  request<Page<ConfiguredTool>>(`/teams/${teamId}/agent-tools${pageQuery(params)}`);

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
