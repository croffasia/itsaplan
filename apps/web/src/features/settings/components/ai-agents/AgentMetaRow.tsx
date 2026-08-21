import type { ComponentType } from 'react';
import { AtSign, BookOpen, ListChecks, Sparkles, UserRoundCheck, Wrench, Zap } from 'lucide-react';
import type { AiAgent } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

// A single meta chip: an icon plus a short value. `accent` tints it for the enabled
// triggers so they stand out from the neutral counts.
function MetaChip({
  icon: Icon,
  children,
  accent = false,
}: {
  icon: ComponentType<{ className?: string }>;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium',
        accent ? 'bg-primary/10 text-primary' : 'bg-muted/60 text-muted-foreground',
      )}
    >
      <Icon className="size-3 shrink-0" />
      {children}
    </span>
  );
}

// The configuration chips for an internal agent: its model and provider, and the counts
// of granted actions, configured tools, and enabled skills. `providerLabel` maps the
// provider key to a readable label from the integration catalog.
export function AgentMetaRow({
  agent,
  providerLabel,
}: {
  agent: AiAgent;
  providerLabel: (key: string) => string;
}) {
  const t = useTranslations('settings.agents');
  const model = agent.model
    ? `${agent.model}${agent.modelProvider ? ` · ${providerLabel(agent.modelProvider)}` : ''}`
    : t('noModel');

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <MetaChip icon={Sparkles}>{model}</MetaChip>
      <MetaChip icon={Zap}>{t('actionCount', { count: agent.actionCount })}</MetaChip>
      <MetaChip icon={Wrench}>{t('toolCount', { count: agent.toolCount })}</MetaChip>
      <MetaChip icon={BookOpen}>{t('skillCount', { count: agent.skillCount })}</MetaChip>
    </div>
  );
}

// The enabled run triggers for an internal agent (mention, delegation, member
// fields), or a muted dash when none are on.
export function AgentTriggers({ agent }: { agent: AiAgent }) {
  const t = useTranslations('settings.agents');
  const fieldCount = agent.fieldTriggers.length;
  if (!agent.triggerOnMention && !agent.triggerOnAssign && fieldCount === 0) {
    return <span className="text-xs text-muted-foreground">{t('triggersNone')}</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {agent.triggerOnMention && (
        <MetaChip icon={AtSign} accent>
          {t('triggerMention')}
        </MetaChip>
      )}
      {agent.triggerOnAssign && (
        <MetaChip icon={UserRoundCheck} accent>
          {t('triggerDelegation')}
        </MetaChip>
      )}
      {fieldCount > 0 && (
        <MetaChip icon={ListChecks} accent>
          {t('triggerFieldCount', { count: fieldCount })}
        </MetaChip>
      )}
    </div>
  );
}
