import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type CredentialPatch,
  type IntegrationKind,
  type NewCredentialInput,
  listCredentials,
  listIntegrationOptions,
  listIntegrationCatalog,
  listIntegrationModels,
  createCredential,
  updateCredential,
  deleteCredential,
} from '@/lib/api/endpoints/integrations';
import type { PageParams } from '@/lib/api/core/paging';
import { qk } from '@/services/queryKeys';

// One page of the team's stored credentials, secrets redacted. Backs the team's
// Integrations tab.
export function useCredentialsPageQuery(teamId: number, params: PageParams) {
  return useQuery({
    queryKey: qk.teamCredentialPage(teamId, params),
    queryFn: () => listCredentials(teamId, params),
    placeholderData: keepPreviousData,
  });
}

// The connected integrations as picker options, for the agent and tool forms. Open
// to any team member, unlike the credential list above.
export function useIntegrationOptionsQuery(teamId: number | null, kind?: IntegrationKind) {
  return useQuery({
    queryKey: qk.integrationOptions(teamId ?? 0, kind),
    queryFn: () => listIntegrationOptions(teamId!, kind),
    enabled: teamId != null,
  });
}

// The integrations the instance offers. Changes only on deploy, so it is cached
// for the session.
export function useIntegrationCatalogQuery(teamId: number | null) {
  return useQuery({
    queryKey: qk.integrationCatalog(teamId ?? 0),
    queryFn: () => listIntegrationCatalog(teamId!),
    enabled: teamId != null,
    staleTime: Infinity,
  });
}

// Models an LLM provider offers (from the models.dev registry). Fetched only when a
// provider is chosen; cached for the session.
export function useIntegrationModelsQuery(teamId: number | null, provider: string | null) {
  return useQuery({
    queryKey: qk.integrationModels(teamId ?? 0, provider ?? ''),
    queryFn: () => listIntegrationModels(teamId!, provider!),
    enabled: teamId != null && provider != null && provider.length > 0,
    staleTime: Infinity,
  });
}

export function useCreateCredential(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewCredentialInput) => createCredential(teamId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.integrations });
      // The team list carries how many credentials the team holds.
      void qc.invalidateQueries({ queryKey: qk.teams });
    },
  });
}

export function useUpdateCredential(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: CredentialPatch }) =>
      updateCredential(teamId, id, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.integrations }),
  });
}

export function useDeleteCredential(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteCredential(teamId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.integrations });
      // The team list carries how many credentials the team holds.
      void qc.invalidateQueries({ queryKey: qk.teams });
    },
  });
}
