import { type ReactNode, useState } from 'react';
import { SlidersHorizontal, Sparkles, Wrench } from 'lucide-react';
import type { TeamProjectOption } from '@/lib/api/endpoints/teams';
import type { AgentTool, AiAgent } from '@/lib/api/endpoints/agents';
import type {
  IntegrationMeta,
  IntegrationOption,
  ProviderModel,
} from '@/lib/api/endpoints/integrations';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { AGENT_KIND_ICON } from '../../utils/agentKindIcon';
import { type AgentFormValue } from '../../utils/agentForm';
import { AgentFormSection } from './AgentFormSection';
import AgentAccessSection from './AgentAccessSection';
import AgentProjectsSection from './AgentProjectsSection';
import AgentTokenSection from './AgentTokenSection';
import AgentModelSection from './AgentModelSection';
import AgentActionsSection from './AgentActionsSection';
import AgentTriggersSection from './AgentTriggersSection';
import { AgentInstructionsField } from './AgentInstructionsField';
import AgentRunnerSection from './AgentRunnerSection';
import { useTranslations } from 'next-intl';

// Which sections open when an existing agent is opened for editing, so the form reads
// as a short list of sections instead of a wall of fields. Basics is not in it because
// it never collapses; the API key section is, because an external agent is unusable
// until its key is in the operator's hands. A new agent starts with all of them closed:
// nothing is filled in yet, and the key section opens itself once a key is issued.
const DEFAULT_OPEN: Record<string, boolean> = { access: true, projects: true, token: true };

// Content width of the full-width editor. The sheet sizes its footer to match, so the
// two must stay in sync.
export const AGENT_EXPANDED_WIDTH = 'max-w-[860px]';

// The agent form: the sections an agent of this kind has, in a stacked column or, at
// full width, beside a section nav. `kindLocked` fixes the kind on edit (the API has
// no kind change). Controlled by value + onChange(patch).
export default function TeamAiAgentFields({
  value,
  onChange,
  projects,
  tools,
  toolsLoading,
  kindLocked,
  expanded = false,
  credentials,
  catalog,
  models,
  modelsLoading,
  agent,
  skillsContent,
  skillsBadge,
  toolsContent,
  toolsBadge,
  revealedKey,
  onRevealedKey,
}: {
  value: AgentFormValue;
  onChange: (patch: Partial<AgentFormValue>) => void;
  // The projects of the team, which the Projects section attaches the agent to and the
  // Triggers section reads the member fields of.
  projects: TeamProjectOption[];
  tools: AgentTool[];
  toolsLoading: boolean;
  kindLocked: boolean;
  expanded?: boolean;
  credentials: IntegrationOption[];
  catalog: IntegrationMeta[];
  models: ProviderModel[];
  modelsLoading: boolean;
  // The saved agent, for the state only the server knows (its runner's presence).
  // Null while creating.
  agent: AiAgent | null;
  // The Skills section body, built by the parent (it owns the skill library and
  // links). Null when Skills does not apply; the section is hidden then.
  skillsContent?: ReactNode | null;
  // "enabled / available" for the Skills header and nav entry. Undefined when the
  // library is empty and there is nothing to count.
  skillsBadge?: string;
  // The Tools section body (configured custom tools), built the same way.
  toolsContent?: ReactNode | null;
  // "enabled / available" for the Tools header and nav entry.
  toolsBadge?: string;
  // The plaintext key issued in this sheet (external agents only), shown once in the
  // API key section, and the way to drop it or replace it after a regenerate.
  revealedKey: string | null;
  onRevealedKey: (apiKey: string | null) => void;
}) {
  const t = useTranslations('teams.agents');
  const tCommon = useTranslations('common');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    agent ? DEFAULT_OPEN : {},
  );
  const sectionProps = (id: string) => ({
    open: openSections[id] ?? false,
    onOpenChange: (o: boolean) => setOpenSections((s) => ({ ...s, [id]: o })),
  });

  // No section header: the name, handle, and instructions are the agent itself, so
  // they open the form as plain fields rather than as one more thing to expand.
  const basicsSection = (
    <div key="basics" className="space-y-4">
      {!kindLocked && (
        <div className="space-y-1.5">
          <span className="text-sm font-medium">{t('kind')}</span>
          <div className="grid grid-cols-2 gap-2">
            {(['external', 'internal'] as const).map((k) => {
              const KindIcon = AGENT_KIND_ICON[k];
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => onChange({ kind: k })}
                  className={`flex items-start gap-2.5 rounded-md px-3 py-2 text-start text-sm transition-colors ${
                    value.kind === k
                      ? 'bg-secondary ring-1 ring-foreground/15'
                      : 'bg-muted/50 hover:bg-accent/60'
                  }`}
                >
                  <KindIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="font-medium">{t(`kindLabel.${k}`)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t(`kindHint.${k}`)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="agent-name" className="text-sm font-medium">
          {tCommon('name')}
        </label>
        <Input
          id="agent-name"
          autoFocus
          placeholder={t('namePlaceholder')}
          value={value.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="agent-username" className="text-sm font-medium">
          {t('username')}
        </label>
        <Input
          id="agent-username"
          placeholder={t('usernamePlaceholder')}
          value={value.username}
          onChange={(e) => onChange({ username: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">{t('usernameHint')}</p>
      </div>

      <AgentInstructionsField
        value={value.instructions}
        onChange={(instructions) => onChange({ instructions })}
      />
    </div>
  );

  const accessSection = (
    <AgentAccessSection
      key="access"
      {...sectionProps('access')}
      value={value}
      onChange={onChange}
    />
  );

  const projectsSection = (
    <AgentProjectsSection
      key="projects"
      {...sectionProps('projects')}
      value={value}
      onChange={onChange}
      projects={projects}
    />
  );

  const tokenSection = (
    <AgentTokenSection
      key="token"
      {...sectionProps('token')}
      agent={agent}
      revealedKey={revealedKey}
      onRevealedKey={onRevealedKey}
    />
  );

  const runnerSection = (
    <AgentRunnerSection key="runner" {...sectionProps('runner')} agent={agent} />
  );

  const modelSection = (
    <AgentModelSection
      key="model"
      {...sectionProps('model')}
      value={value}
      onChange={onChange}
      credentials={credentials}
      catalog={catalog}
      models={models}
      modelsLoading={modelsLoading}
    />
  );

  const actionsSection = (
    <AgentActionsSection
      key="actions"
      {...sectionProps('actions')}
      tools={tools}
      toolsLoading={toolsLoading}
      selected={value.tools}
      onChange={(keys) => onChange({ tools: keys })}
    />
  );

  const triggersSection = (
    <AgentTriggersSection
      key="triggers"
      {...sectionProps('triggers')}
      value={value}
      onChange={onChange}
      projects={projects}
    />
  );

  const skillsSection =
    skillsContent != null ? (
      <AgentFormSection
        key="skills"
        {...sectionProps('skills')}
        icon={Sparkles}
        title={t('skills')}
        hint={t('skillsHint')}
        headerRight={skillsBadge}
      >
        {skillsContent}
      </AgentFormSection>
    ) : null;

  const toolsSection =
    toolsContent != null ? (
      <AgentFormSection
        key="tools"
        {...sectionProps('tools')}
        icon={Wrench}
        title={t('tools')}
        hint={t('toolsHint')}
        headerRight={toolsBadge}
      >
        {toolsContent}
      </AgentFormSection>
    ) : null;

  const advancedSection = (
    <AgentFormSection
      key="advanced"
      {...sectionProps('advanced')}
      icon={SlidersHorizontal}
      title={t('advanced')}
      hint={t('advancedHint')}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="agent-temperature" className="text-sm font-medium">
            {t('temperature')}
          </label>
          <Input
            id="agent-temperature"
            type="number"
            step="0.1"
            min="0"
            max="2"
            placeholder={t('optional')}
            value={value.temperature}
            onChange={(e) => onChange({ temperature: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="agent-max-steps" className="text-sm font-medium">
            {t('maxSteps')}
          </label>
          <Input
            id="agent-max-steps"
            type="number"
            step="1"
            min="1"
            placeholder={t('optional')}
            value={value.maxSteps}
            onChange={(e) => onChange({ maxSteps: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="flex cursor-pointer items-start gap-2">
          <Checkbox
            className="mt-0.5"
            checked={value.memoryEnabled}
            onCheckedChange={(v) => onChange({ memoryEnabled: v === true })}
          />
          <span>
            <span className="text-sm font-medium">{t('memory')}</span>
            <span className="block text-xs text-muted-foreground">{t('memoryHint')}</span>
          </span>
        </label>
        {value.memoryEnabled && (
          <div className="space-y-1.5 ps-6">
            <label htmlFor="agent-memory-n" className="text-sm font-medium">
              {t('memoryCount')}
            </label>
            <Input
              id="agent-memory-n"
              type="number"
              step="1"
              min="1"
              placeholder={t('memoryCountPlaceholder')}
              value={value.memoryLastMessages}
              onChange={(e) => onChange({ memoryLastMessages: e.target.value })}
            />
          </div>
        )}
      </div>
    </AgentFormSection>
  );

  const stack =
    value.kind === 'external'
      ? [
          basicsSection,
          projectsSection,
          tokenSection,
          accessSection,
          triggersSection,
          runnerSection,
        ]
      : [
          basicsSection,
          projectsSection,
          modelSection,
          advancedSection,
          triggersSection,
          actionsSection,
          skillsSection,
          toolsSection,
        ];

  // Full width: one readable column of sections, scrolling inside this component so
  // the sheet's header and footer stay put.
  if (expanded) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-5 pb-10 sm:px-6 sm:pt-2">
        <div className={`mx-auto w-full space-y-8 ${AGENT_EXPANDED_WIDTH}`}>{stack}</div>
      </div>
    );
  }

  // Compact side panel: the same sections stacked in one column.
  return <div className="space-y-8">{stack}</div>;
}
