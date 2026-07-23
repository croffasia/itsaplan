import { useEffect, useRef, useState } from 'react';
import type { AiAgent } from '@/lib/api';
import {
  useCreateAiAgent,
  useUpdateAiAgent,
  useAgentToolsQuery,
} from '@/services/aiAgents.service';
import {
  useCredentialsQuery,
  useIntegrationCatalogQuery,
  useIntegrationModelsQuery,
} from '@/services/integrations.service';
import { useRolesQuery } from '@/services/roles.service';
import {
  useSkillsQuery,
  useAgentSkillsQuery,
  useSetAgentSkills,
} from '@/services/agentSkills.service';
import {
  useConfiguredToolsQuery,
  useAgentToolLinksQuery,
  useSetAgentTools,
} from '@/services/customTools.service';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { AgentCapabilityList } from './AgentCapabilityList';
import SettingsAiAgentFields from './SettingsAiAgentFields';
import { AGENT_EXPANDED_WIDTH } from './AgentExpandedLayout';
import AgentKeyBanner from './AgentKeyBanner';
import {
  initialAgentValue,
  isAgentFormValid,
  suggestUsername,
  toCreateInput,
  toUpdatePatch,
  type AgentFormValue,
} from '../../utils/agentForm';
import { integrationLabel } from '../../utils/integrationLabels';

// The Edit tab of the agent sheet, used for both create and edit. With no agent it
// creates one; once created (onCreated lifts it to the sheet) the same form switches
// to editing that agent without remounting, so the entered values stay. The kind can
// be chosen on create but not changed after. A new external agent's key is revealed
// once, inline at the top, via revealedKey. An internal agent's enabled skills are
// managed once the agent exists (they are linked through a separate endpoint).
export function AgentSheetForm({
  projectKey,
  agent,
  expanded = false,
  onCreated,
  revealedKey,
  onDismissKey,
}: {
  projectKey: string;
  agent: AiAgent | null;
  expanded?: boolean;
  onCreated: (agent: AiAgent, apiKey: string | null) => void;
  revealedKey: string | null;
  onDismissKey: () => void;
}) {
  const [value, setValue] = useState<AgentFormValue>(() => initialAgentValue(agent ?? undefined));
  const isCreate = agent == null;
  // While creating, the username is derived from the name until the user edits it.
  // Clearing the username field resumes auto-generation.
  const [usernameEdited, setUsernameEdited] = useState(false);

  // Skills are a separate permission; when the user can't manage them, the Skills
  // section is hidden and its queries and save are skipped (the backend enforces it
  // too). Providers are their own resource — the model select just stays empty when
  // the user can't read them.
  const { can } = usePermissions();
  const canManageSkills = can('agent_skills', 'edit');
  const canManageTools = can('agent_tools', 'edit');

  const toolsQuery = useAgentToolsQuery(projectKey);
  const catalogQuery = useIntegrationCatalogQuery(projectKey);
  const catalog = catalogQuery.data ?? [];
  const credentialsQuery = useCredentialsQuery(projectKey);
  const credentials = credentialsQuery.data ?? [];
  // Only LLM-provider credentials can back a model.
  const llmCredentials = credentials.filter(
    (c) => catalog.find((i) => i.key === c.integrationKey)?.kind === 'llm',
  );
  const selectedProvider =
    credentials.find((c) => c.id === value.modelCredentialId)?.integrationKey ?? null;
  const providerModelsQuery = useIntegrationModelsQuery(
    projectKey,
    value.kind === 'internal' ? selectedProvider : null,
  );
  const rolesQuery = useRolesQuery(projectKey, value.kind === 'external');
  const skillsLibraryQuery = useSkillsQuery(
    value.kind === 'internal' && canManageSkills ? projectKey : null,
  );
  const agentSkillsQuery = useAgentSkillsQuery(
    projectKey,
    agent && agent.kind === 'internal' && canManageSkills ? agent.id : null,
  );
  const toolsLibraryQuery = useConfiguredToolsQuery(
    value.kind === 'internal' && canManageTools ? projectKey : null,
  );
  const agentToolsQuery = useAgentToolLinksQuery(
    projectKey,
    agent && agent.kind === 'internal' && canManageTools ? agent.id : null,
  );

  const createAgent = useCreateAiAgent(projectKey);
  const updateAgent = useUpdateAiAgent(projectKey);
  const setAgentSkills = useSetAgentSkills(projectKey);
  const setAgentTools = useSetAgentTools(projectKey);
  const saving =
    createAgent.isPending ||
    updateAgent.isPending ||
    setAgentSkills.isPending ||
    setAgentTools.isPending;

  // A new agent starts with every action granted. Seed the tool set once the action
  // catalog loads, only while creating and only if the user has not changed it yet.
  const toolsSeeded = useRef(false);
  useEffect(() => {
    const actions = toolsQuery.data;
    if (isCreate && !toolsSeeded.current && actions && actions.length > 0) {
      toolsSeeded.current = true;
      setValue((v) => ({ ...v, tools: actions.map((t) => t.key) }));
    }
  }, [isCreate, toolsQuery.data]);

  // The agent's enabled skills, seeded from the server once loaded (edit mode only).
  const [skillIds, setSkillIds] = useState<number[] | null>(null);
  useEffect(() => {
    if (agentSkillsQuery.data && skillIds === null) {
      setSkillIds(agentSkillsQuery.data.map((s) => s.id));
    }
  }, [agentSkillsQuery.data, skillIds]);
  const selectedSkills = skillIds ?? [];

  // The agent's enabled custom tools, seeded from the server once loaded (edit only).
  const [toolIds, setToolIds] = useState<number[] | null>(null);
  useEffect(() => {
    if (agentToolsQuery.data && toolIds === null) {
      setToolIds(agentToolsQuery.data.map((t) => t.id));
    }
  }, [agentToolsQuery.data, toolIds]);
  const selectedTools = toolIds ?? [];

  function merge(patch: Partial<AgentFormValue>) {
    setValue((prev) => {
      const next = { ...prev, ...patch };
      if (isCreate && 'name' in patch && !usernameEdited) {
        next.username = suggestUsername(next.name);
      }
      return next;
    });
    if ('username' in patch) setUsernameEdited((patch.username ?? '').trim() !== '');
  }

  function toggleSkill(id: number, on: boolean) {
    setSkillIds((prev) => {
      const base = prev ?? [];
      return on ? [...new Set([...base, id])] : base.filter((x) => x !== id);
    });
  }

  function toggleTool(id: number, on: boolean) {
    setToolIds((prev) => {
      const base = prev ?? [];
      return on ? [...new Set([...base, id])] : base.filter((x) => x !== id);
    });
  }

  async function submit() {
    if (!isAgentFormValid(value) || saving) return;
    if (isCreate) {
      const res = await createAgent.mutateAsync(toCreateInput(value));
      // Link the picked skills/tools against the freshly created agent id (the join
      // tables need an id, which only exists after the create returns).
      if (res.agent.kind === 'internal' && canManageSkills && skillIds && skillIds.length > 0) {
        await setAgentSkills.mutateAsync({ agentId: res.agent.id, skillIds });
      }
      if (res.agent.kind === 'internal' && canManageTools && toolIds && toolIds.length > 0) {
        await setAgentTools.mutateAsync({ agentId: res.agent.id, agentToolIds: toolIds });
      }
      onCreated(res.agent, res.apiKey);
    } else {
      await updateAgent.mutateAsync({ id: agent.id, patch: toUpdatePatch(value) });
      if (agent.kind === 'internal' && canManageSkills && skillIds !== null) {
        await setAgentSkills.mutateAsync({ agentId: agent.id, skillIds });
      }
      if (agent.kind === 'internal' && canManageTools && toolIds !== null) {
        await setAgentTools.mutateAsync({ agentId: agent.id, agentToolIds: toolIds });
      }
    }
  }

  const skillsLibrary = skillsLibraryQuery.data ?? [];
  const showSkills = value.kind === 'internal' && canManageSkills;

  // The Skills section body (the fields layout wraps it in a section). The configured
  // skill library the agent may load.
  const skillsContent = showSkills ? (
    skillsLibrary.length === 0 ? (
      <p className="text-xs text-muted-foreground">
        No skills in the library yet. Add one on the Skills page.
      </p>
    ) : (
      <AgentCapabilityList
        searchPlaceholder="Search skills"
        onToggle={toggleSkill}
        items={skillsLibrary.map((skill) => ({
          id: skill.id,
          checked: selectedSkills.includes(skill.id),
          title: skill.name,
          subtitle: skill.description || 'No description',
          search: `${skill.name} ${skill.description ?? ''}`.toLowerCase(),
        }))}
      />
    )
  ) : null;

  const toolsLibrary = toolsLibraryQuery.data ?? [];
  const showTools = value.kind === 'internal' && canManageTools;

  // The Tools section body: the configured custom tools the agent may call.
  const toolsContent = showTools ? (
    toolsLibrary.length === 0 ? (
      <p className="text-xs text-muted-foreground">
        No tools configured yet. Add one on the Tools page.
      </p>
    ) : (
      <AgentCapabilityList
        searchPlaceholder="Search tools"
        onToggle={toggleTool}
        items={toolsLibrary.map((tool) => {
          const toolLabel =
            catalog.flatMap((i) => i.tools).find((t) => t.key === tool.toolKey)?.label ??
            tool.toolKey;
          const integration = integrationLabel(catalog, tool.integrationKey);
          const on = tool.credentialLabel
            ? `${integration} · ${tool.credentialLabel}`
            : integration;
          return {
            id: tool.id,
            checked: selectedTools.includes(tool.id),
            title: toolLabel,
            subtitle: on,
            search: `${toolLabel} ${on}`.toLowerCase(),
          };
        })}
      />
    )
  ) : null;

  const banner =
    revealedKey !== null ? <AgentKeyBanner apiKey={revealedKey} onDismiss={onDismissKey} /> : null;

  // The full-width internal editor owns its scroll container (it holds the section
  // nav's scroll spy). Every other case stacks in a single readable column here.
  const ownsScroll = expanded && value.kind === 'internal';
  let contentWidth = '';
  if (ownsScroll) contentWidth = AGENT_EXPANDED_WIDTH;
  else if (expanded) contentWidth = 'max-w-2xl';

  const fields = (
    <SettingsAiAgentFields
      value={value}
      onChange={merge}
      projectKey={projectKey}
      tools={toolsQuery.data ?? []}
      toolsLoading={toolsQuery.isLoading}
      kindLocked={!isCreate}
      expanded={expanded}
      credentials={llmCredentials}
      catalog={catalog}
      models={providerModelsQuery.data ?? []}
      modelsLoading={providerModelsQuery.isLoading}
      roles={rolesQuery.data ?? []}
      skillsContent={skillsContent}
      toolsContent={toolsContent}
      banner={banner}
    />
  );

  return (
    <form
      className="flex h-full min-h-0 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {ownsScroll ? (
        fields
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-1 pb-6">
          <div className={`mx-auto w-full space-y-6 ${contentWidth}`}>
            {banner}
            {fields}
          </div>
        </div>
      )}
      <div className="border-t border-border/60 px-6 py-3">
        <div className={`mx-auto flex w-full ${contentWidth} ${expanded ? 'justify-end' : ''}`}>
          <Button
            type="submit"
            className={expanded ? 'min-w-40' : 'w-full'}
            disabled={!isAgentFormValid(value) || saving}
          >
            {saving ? 'Saving…' : isCreate ? 'Create agent' : 'Save agent'}
          </Button>
        </div>
      </div>
    </form>
  );
}
