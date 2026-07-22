import { type ReactNode, useState } from 'react';
import {
  Cpu,
  IdCard,
  ListChecks,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Wrench,
  Zap,
} from 'lucide-react';
import type {
  AgentTool,
  IntegrationCredential,
  IntegrationMeta,
  ProviderModel,
  Role,
} from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type AgentFormValue, grantedToolCount } from '../../utils/agentForm';
import { AgentFormSection } from './AgentFormSection';
import { type AgentNavSection } from './AgentSectionNav';
import AgentExpandedLayout from './AgentExpandedLayout';
import AgentModelSection from './AgentModelSection';
import AgentActionsSection from './AgentActionsSection';

// Sentinel select value for "no explicit role" (falls back to the project default).
const DEFAULT_ROLE_VALUE = '__default__';

// Which sections open when the form first renders. Core sections start open; the
// optional/heavy ones (Skills, Tools, Advanced) start collapsed to keep the initial
// view short.
const DEFAULT_OPEN: Record<string, boolean> = {
  basics: true,
  access: true,
  model: true,
  triggers: true,
  actions: true,
  skills: false,
  tools: false,
  advanced: false,
};

// The agent form: the sections an agent of this kind has, in a stacked column or, for
// a full-width internal agent, beside a section nav. `kindLocked` fixes the kind on
// edit (the API has no kind change). Controlled by value + onChange(patch).
export default function SettingsAiAgentFields({
  value,
  onChange,
  projectKey,
  tools,
  toolsLoading,
  kindLocked,
  expanded = false,
  credentials,
  catalog,
  models,
  modelsLoading,
  roles,
  skillsContent,
  toolsContent,
  banner,
}: {
  value: AgentFormValue;
  onChange: (patch: Partial<AgentFormValue>) => void;
  projectKey: string;
  tools: AgentTool[];
  toolsLoading: boolean;
  kindLocked: boolean;
  expanded?: boolean;
  credentials: IntegrationCredential[];
  catalog: IntegrationMeta[];
  models: ProviderModel[];
  modelsLoading: boolean;
  roles: Role[];
  // The Skills section body, built by the parent (it owns the skill library and
  // links). Null when Skills does not apply; the section is hidden then.
  skillsContent?: ReactNode | null;
  // The Tools section body (configured custom tools), built the same way.
  toolsContent?: ReactNode | null;
  // Optional strip rendered above the form (the revealed-key banner on create),
  // used by the full-width internal layout which owns its own scroll container.
  banner?: ReactNode;
}) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(DEFAULT_OPEN);
  const sectionProps = (id: string) => ({
    id,
    open: openSections[id] ?? false,
    onOpenChange: (o: boolean) => setOpenSections((s) => ({ ...s, [id]: o })),
  });

  const basicsSection = (
    <AgentFormSection key="basics" {...sectionProps('basics')} icon={IdCard} title="Basics">
      {!kindLocked && (
        <div className="space-y-1.5">
          <span className="text-sm font-medium">Kind</span>
          <div className="grid grid-cols-2 gap-2">
            {(['external', 'internal'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => onChange({ kind: k })}
                className={`rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  value.kind === k
                    ? 'bg-secondary ring-1 ring-foreground/15'
                    : 'bg-muted/50 hover:bg-accent/60'
                }`}
              >
                <span className="font-medium capitalize">{k}</span>
                <span className="block text-xs text-muted-foreground">
                  {k === 'external' ? 'Driven through the API' : 'Run by the built-in runtime'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="agent-name" className="text-sm font-medium">
          Name
        </label>
        <Input
          id="agent-name"
          autoFocus
          placeholder="e.g. Triage bot"
          value={value.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="agent-username" className="text-sm font-medium">
          Username
        </label>
        <Input
          id="agent-username"
          placeholder="e.g. triage-bot"
          value={value.username}
          onChange={(e) => onChange({ username: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Letters, digits, dots, dashes, and underscores. Up to 64 characters.
        </p>
      </div>
    </AgentFormSection>
  );

  const accessSection = (
    <AgentFormSection
      key="access"
      {...sectionProps('access')}
      icon={Shield}
      title="Access"
      hint="The permissions the agent acts under"
    >
      <div className="space-y-1.5">
        <span className="text-sm font-medium">Role</span>
        <Select
          value={value.roleId != null ? String(value.roleId) : DEFAULT_ROLE_VALUE}
          onValueChange={(v) => onChange({ roleId: v === DEFAULT_ROLE_VALUE ? null : Number(v) })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Choose a role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT_ROLE_VALUE}>Default role</SelectItem>
            {roles.map((r) => (
              <SelectItem key={r.id} value={String(r.id)}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {value.kind === 'external'
            ? "The agent's API requests are limited to what this role permits."
            : 'The agent can only do what both this role and its actions allow. An action the role denies fails at runtime.'}
        </p>
      </div>
    </AgentFormSection>
  );

  const modelSection = (
    <AgentModelSection
      key="model"
      {...sectionProps('model')}
      value={value}
      onChange={onChange}
      projectKey={projectKey}
      credentials={credentials}
      catalog={catalog}
      models={models}
      modelsLoading={modelsLoading}
    />
  );

  const activeCount = grantedToolCount(tools, value.tools);

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
    <AgentFormSection
      key="triggers"
      {...sectionProps('triggers')}
      icon={Zap}
      title="Triggers"
      hint="When the agent runs on its own"
    >
      <label className="flex cursor-pointer items-center justify-between gap-2">
        <span>
          <span className="text-sm">React to mentions</span>
          <span className="block text-xs text-muted-foreground">
            Run when @-mentioned in a comment.
          </span>
        </span>
        <Switch
          checked={value.triggerOnMention}
          onCheckedChange={(v) => onChange({ triggerOnMention: v })}
        />
      </label>
      <label className="flex cursor-pointer items-center justify-between gap-2">
        <span>
          <span className="text-sm">React to delegation</span>
          <span className="block text-xs text-muted-foreground">
            Run when set as an issue&apos;s delegate.
          </span>
        </span>
        <Switch
          checked={value.triggerOnAssign}
          onCheckedChange={(v) => onChange({ triggerOnAssign: v })}
        />
      </label>
    </AgentFormSection>
  );

  const skillsSection =
    skillsContent != null ? (
      <AgentFormSection
        key="skills"
        {...sectionProps('skills')}
        icon={Sparkles}
        title="Skills"
        hint="Reusable instructions the agent can load"
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
        title="Tools"
        hint="External integrations the agent can call"
      >
        {toolsContent}
      </AgentFormSection>
    ) : null;

  const advancedSection = (
    <AgentFormSection
      key="advanced"
      {...sectionProps('advanced')}
      icon={SlidersHorizontal}
      title="Advanced"
      hint="Sampling, step limit, and memory"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="agent-temperature" className="text-sm font-medium">
            Temperature
          </label>
          <Input
            id="agent-temperature"
            type="number"
            step="0.1"
            min="0"
            max="2"
            placeholder="Optional"
            value={value.temperature}
            onChange={(e) => onChange({ temperature: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="agent-max-steps" className="text-sm font-medium">
            Max steps
          </label>
          <Input
            id="agent-max-steps"
            type="number"
            step="1"
            min="1"
            placeholder="Optional"
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
            <span className="text-sm font-medium">Conversation memory</span>
            <span className="block text-xs text-muted-foreground">
              Recall recent messages within a conversation thread.
            </span>
          </span>
        </label>
        {value.memoryEnabled && (
          <div className="space-y-1.5 pl-6">
            <label htmlFor="agent-memory-n" className="text-sm font-medium">
              Remember last N messages
            </label>
            <Input
              id="agent-memory-n"
              type="number"
              step="1"
              min="1"
              placeholder="e.g. 20"
              value={value.memoryLastMessages}
              onChange={(e) => onChange({ memoryLastMessages: e.target.value })}
            />
          </div>
        )}
      </div>
    </AgentFormSection>
  );

  // Full-width internal agent: a sticky section nav on the left and one readable
  // column of borderless sections on the right, inside this component's own scroll
  // container so the nav's scroll spy can track which section is in view.
  if (expanded && value.kind === 'internal') {
    const navSections: AgentNavSection[] = [
      { id: 'basics', label: 'Basics', icon: IdCard },
      { id: 'model', label: 'Model', icon: Cpu },
      { id: 'triggers', label: 'Triggers', icon: Zap },
      {
        id: 'actions',
        label: 'Actions',
        icon: ListChecks,
        badge: tools.length > 0 ? `${activeCount}/${tools.length}` : undefined,
      },
      ...(skillsSection ? [{ id: 'skills', label: 'Skills', icon: Sparkles }] : []),
      ...(toolsSection ? [{ id: 'tools', label: 'Tools', icon: Wrench }] : []),
      { id: 'advanced', label: 'Advanced', icon: SlidersHorizontal },
    ];

    return (
      <AgentExpandedLayout
        navSections={navSections}
        banner={banner}
        onExpand={(id) => setOpenSections((s) => ({ ...s, [id]: true }))}
      >
        {basicsSection}
        {modelSection}
        {triggersSection}
        {actionsSection}
        {skillsSection}
        {toolsSection}
        {advancedSection}
      </AgentExpandedLayout>
    );
  }

  // Compact side panel (and expanded external agent): a single stacked column.
  return (
    <div className="space-y-8">
      {basicsSection}
      {value.kind === 'external' ? (
        accessSection
      ) : (
        <>
          {modelSection}
          {actionsSection}
          {triggersSection}
          {skillsSection}
          {toolsSection}
          {advancedSection}
        </>
      )}
    </div>
  );
}
