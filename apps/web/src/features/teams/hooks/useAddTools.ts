import { useMemo, useState } from 'react';
import type { IntegrationMeta, IntegrationOption } from '@/lib/api/endpoints/integrations';
import {
  useConfiguredToolOptionsQuery,
  useCreateConfiguredTool,
} from '@/services/customTools.service';
import { useIntegrationOptionsQuery } from '@/services/integrations.service';
import {
  matchingTools,
  toolIntegrations,
  type ToolIntegration,
  type ToolOption,
} from '../utils/toolCatalog';

// One integration in the add-tool dialog, with what the team already holds for it.
export interface ToolIntegrationEntry {
  integration: ToolIntegration;
  // The tools the search leaves.
  tools: ToolOption[];
  credentials: IntegrationOption[];
  // The credential its tools are added on, null for none.
  credentialId: number | null;
  // False while it needs a credential and the team has none: its tools are listed
  // and cannot be selected.
  ready: boolean;
  // Tools already configured on that credential. The API answers 409 for a duplicate.
  added: string[];
  // The selected tools that are not added yet.
  pending: ToolOption[];
}

// The state of the add-tool dialog: the catalog split by integration, a selection that
// spans integrations, and one credential per integration to add its tools on.
export function useAddTools(teamId: number, catalog: IntegrationMeta[], onDone: () => void) {
  const integrations = useMemo(
    () => toolIntegrations(catalog).sort((a, b) => a.label.localeCompare(b.label)),
    [catalog],
  );
  const credentials = useIntegrationOptionsQuery(teamId, 'tool').data;
  const configured = useConfiguredToolOptionsQuery(teamId).data;
  const create = useCreateConfiguredTool(teamId);

  const [query, setQuery] = useState('');
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  // null picks no credential for an integration whose credential is optional.
  const [chosen, setChosen] = useState<Record<string, number | null>>({});
  const [busy, setBusy] = useState(false);

  const all = useMemo<ToolIntegrationEntry[]>(
    () =>
      integrations.map((integration) => {
        const own = (credentials ?? []).filter((c) => c.integrationKey === integration.key);
        let credentialId: number | null = null;
        if (integration.takesCredential) {
          credentialId = integration.key in chosen ? chosen[integration.key] : (own[0]?.id ?? null);
        }
        const ready = !integration.needsCredential || own.length > 0;
        const added = (configured ?? [])
          .filter((c) => c.credentialId === credentialId)
          .map((c) => c.toolKey);
        return {
          integration,
          tools: matchingTools(integration, query),
          credentials: own,
          credentialId,
          ready,
          added,
          pending: ready
            ? integration.tools.filter(
                (o) => selected.includes(o.toolKey) && !added.includes(o.toolKey),
              )
            : [],
        };
      }),
    [integrations, credentials, configured, chosen, query, selected],
  );

  const entries = all.filter((e) => e.tools.length > 0);
  const active =
    entries.find((e) => e.integration.key === activeKey) ??
    entries.find((e) => e.ready) ??
    entries[0] ??
    null;
  const pending = all.filter((e) => e.pending.length > 0);

  async function submit() {
    setBusy(true);
    try {
      for (const entry of pending) {
        for (const tool of entry.pending) {
          await create.mutateAsync({
            toolKey: tool.toolKey,
            credentialId: entry.credentialId ?? undefined,
          });
        }
      }
      onDone();
    } catch {
      setBusy(false);
    }
  }

  return {
    loading: credentials === undefined || configured === undefined,
    query,
    setQuery,
    entries,
    active,
    open: setActiveKey,
    selected,
    toggle: (toolKeys: string[], on: boolean) =>
      setSelected((prev) =>
        on ? [...new Set([...prev, ...toolKeys])] : prev.filter((k) => !toolKeys.includes(k)),
      ),
    clear: () => setSelected([]),
    setCredential: (integrationKey: string, credentialId: number | null) =>
      setChosen((prev) => ({ ...prev, [integrationKey]: credentialId })),
    pending,
    busy,
    submit,
  };
}
