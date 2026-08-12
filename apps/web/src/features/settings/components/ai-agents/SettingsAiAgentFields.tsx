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
import type { AgentTool, IntegrationMeta, IntegrationOption, ProviderModel, Role } from '@/lib/api';
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
import { type SectionNavItem } from '@/components/common/page/SectionNav';
import { type AgentFormValue, grantedToolCount } from '../../utils/agentForm';
import { AgentFormSection } from './AgentFormSection';
import AgentExpandedLayout from './AgentExpandedLayout';
import AgentModelSection from './AgentModelSection';
import AgentActionsSection from './AgentActionsSection';
import { useTranslations } from 'next-intl';

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
  credentials: IntegrationOption[];
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
  const t = useTranslations('settings.agents');
  const tCommon = useTranslations('common');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(DEFAULT_OPEN);
  const sectionProps = (id: string) => ({
    id,
    open: openSections[id] ?? false,
    onOpenChange: (o: boolean) => setOpenSections((s) => ({ ...s, [id]: o })),
  });

  const basicsSection = (
    <AgentFormSection key="basics" {...sectionProps('basics')} icon={IdCard} title={t('basics')}>
      {!kindLocked && (
        <div className="space-y-1.5">
          <span className="text-sm font-medium">{t('kind')}</span>
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
                <span className="font-medium">{t(`kindLabel.${k}`)}</span>
                <span className="block text-xs text-muted-foreground">{t(`kindHint.${k}`)}</span>
              </button>
            ))}
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
    </AgentFormSection>
  );

  const accessSection = (
    <AgentFormSection
      key="access"
      {...sectionProps('access')}
      icon={Shield}
      title={t('access')}
      hint={t('accessHint')}
    >
      <div className="space-y-1.5">
        <span className="text-sm font-medium">{t('role')}</span>
        <Select
          value={value.roleId != null ? String(value.roleId) : DEFAULT_ROLE_VALUE}
          onValueChange={(v) => onChange({ roleId: v === DEFAULT_ROLE_VALUE ? null : Number(v) })}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('chooseRole')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT_ROLE_VALUE}>{t('defaultRole')}</SelectItem>
            {roles.map((r) => (
              <SelectItem key={r.id} value={String(r.id)}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {value.kind === 'external' ? t('roleHintExternal') : t('roleHintInternal')}
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
      title={t('triggers')}
      hint={t('triggersHint')}
    >
      <label className="flex cursor-pointer items-center justify-between gap-2">
        <span>
          <span className="text-sm">{t('onMention')}</span>
          <span className="block text-xs text-muted-foreground">{t('onMentionHint')}</span>
        </span>
        <Switch
          checked={value.triggerOnMention}
          onCheckedChange={(v) => onChange({ triggerOnMention: v })}
        />
      </label>
      <label className="flex cursor-pointer items-center justify-between gap-2">
        <span>
          <span className="text-sm">{t('onDelegation')}</span>
          <span className="block text-xs text-muted-foreground">{t('onDelegationHint')}</span>
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
        title={t('skills')}
        hint={t('skillsHint')}
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
          <div className="space-y-1.5 pl-6">
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

  // Full-width internal agent: a sticky section nav on the left and one readable
  // column of borderless sections on the right, inside this component's own scroll
  // container so the nav's scroll spy can track which section is in view.
  if (expanded && value.kind === 'internal') {
    const navSections: SectionNavItem[] = [
      { id: 'basics', label: t('basics'), icon: IdCard },
      { id: 'model', label: t('model'), icon: Cpu },
      { id: 'triggers', label: t('triggers'), icon: Zap },
      {
        id: 'actions',
        label: t('actions'),
        icon: ListChecks,
        badge: tools.length > 0 ? `${activeCount}/${tools.length}` : undefined,
      },
      ...(skillsSection ? [{ id: 'skills', label: t('skills'), icon: Sparkles }] : []),
      ...(toolsSection ? [{ id: 'tools', label: t('tools'), icon: Wrench }] : []),
      { id: 'advanced', label: t('advanced'), icon: SlidersHorizontal },
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
