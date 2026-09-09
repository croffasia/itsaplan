import { request } from '@/lib/api/core/client';
import { pageQuery, type Page, type PageParams } from '@/lib/api/core/paging';

// A field of an integration's credential form (from the catalog). `type` "secret"
// marks a value stored encrypted and shown masked.
export interface ConfigField {
  key: string;
  label: string;
  type: 'string' | 'secret' | 'url' | 'number' | 'boolean';
  required: boolean;
  placeholder?: string;
  help?: string;
}

// 'llm' is an AI provider (its models an agent runs on, no tools); 'tool' is a tool
// integration whose `tools` are configured on a credential.
export type IntegrationKind = 'llm' | 'tool';

// An integration the team can store a credential for (server-side catalog).
export interface IntegrationMeta {
  key: string;
  label: string;
  kind: IntegrationKind;
  credentialSchema: ConfigField[];
  tools: { key: string; label: string; description: string; scopes?: string[] }[];
}

// A model an LLM provider offers, from the models.dev registry.
export interface ProviderModel {
  id: string;
  name: string;
}

// A stored integration credential. `redacted` mirrors the stored credential with
// secret fields masked; the real secrets are never returned.
export interface IntegrationCredential {
  id: number;
  teamId: number;
  integrationKey: string;
  label: string | null;
  redacted: Record<string, unknown>;
  createdAt: string;
}

// A connected integration as a picker option: what it is and what it is called,
// with none of the credential fields the admin list carries.
export interface IntegrationOption {
  id: number;
  integrationKey: string;
  kind: IntegrationKind;
  label: string | null;
}

export interface NewCredentialInput {
  integrationKey: string;
  label?: string | null;
  credential: Record<string, unknown>;
}

export interface CredentialPatch {
  label?: string | null;
  // Only the fields being changed. Secret fields left out keep their stored value.
  credential?: Record<string, unknown>;
}

// Integrations: the team's stored credentials for LLM providers and tool
// integrations, shared by every project it owns. The secret is write-only —
// responses carry only a redacted view.
export const listIntegrationCatalog = (teamId: number) =>
  request<IntegrationMeta[]>(`/teams/${teamId}/integrations/catalog`);

export const listIntegrationModels = (teamId: number, provider: string) =>
  request<ProviderModel[]>(`/teams/${teamId}/integrations/models/${encodeURIComponent(provider)}`);

export const listCredentials = (teamId: number, params: PageParams) =>
  request<Page<IntegrationCredential>>(`/teams/${teamId}/integrations${pageQuery(params)}`);

export const listIntegrationOptions = (teamId: number, kind?: IntegrationKind) =>
  request<IntegrationOption[]>(
    `/teams/${teamId}/integrations/options${kind ? `?kind=${kind}` : ''}`,
  );

export const createCredential = (teamId: number, input: NewCredentialInput) =>
  request<IntegrationCredential>(`/teams/${teamId}/integrations`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateCredential = (teamId: number, credentialId: number, patch: CredentialPatch) =>
  request<IntegrationCredential>(`/teams/${teamId}/integrations/${credentialId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });

export const deleteCredential = (teamId: number, credentialId: number) =>
  request<void>(`/teams/${teamId}/integrations/${credentialId}`, { method: 'DELETE' });
