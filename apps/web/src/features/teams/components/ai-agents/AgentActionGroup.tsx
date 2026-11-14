import {
  BookOpenText,
  ChevronRight,
  FolderKanban,
  Lock,
  RefreshCw,
  SquareKanban,
  StickyNote,
  Target,
  type LucideIcon,
} from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { AgentTool } from '@/lib/api/endpoints/agents';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { MatrixCheckbox } from '@/components/common/permissions/MatrixCheckbox';
import { AgentActionRow } from './AgentActionRow';

const GROUP_ICONS: Record<AgentTool['group'], LucideIcon> = {
  issues: SquareKanban,
  initiatives: Target,
  cycles: RefreshCw,
  documents: BookOpenText,
  notes: StickyNote,
  project: FolderKanban,
};

// One feature's actions in the Actions section. Folded, its row says what of it the agent
// has; open, it lists the opt-in actions, then the read-only ones it always has. The box on
// the row turns all its opt-in actions on or off. `all` is the whole group, `shown` what the
// search leaves of it.
export function AgentActionGroup({
  group,
  all,
  shown,
  selected,
  onToggle,
  open,
  onOpenChange,
}: {
  group: AgentTool['group'];
  all: AgentTool[];
  shown: AgentTool[];
  selected: string[];
  onToggle: (keys: string[], on: boolean) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('teams.agents');
  const format = useFormatter();
  const Icon = GROUP_ICONS[group];
  const name = t(`actionGroup.${group}`);
  const optIn = all.filter((tool) => !tool.always);
  const on = optIn.filter((tool) => selected.includes(tool.key));
  const alwaysCount = all.length - optIn.length;
  const allOn = optIn.length > 0 && on.length === optIn.length;

  let summary: string;
  let boxState: boolean | 'indeterminate' = false;
  if (optIn.length === 0) {
    summary = t('alwaysOn');
  } else if (allOn) {
    summary = t('summaryAll');
    boxState = true;
  } else if (on.length === 0) {
    summary = t(alwaysCount > 0 ? 'summaryReadOnly' : 'summaryNone');
  } else {
    const named = on.slice(0, 2);
    const names = format.list(
      named.map((tool) => tool.label),
      { type: 'unit' },
    );
    summary =
      on.length > named.length
        ? t('summarySome', { names, count: on.length - named.length })
        : names;
    boxState = 'indeterminate';
  }

  const shownOptIn = shown.filter((tool) => !tool.always);
  const shownAlways = shown.filter((tool) => tool.always);
  const rows = (tools: AgentTool[]) => (
    <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
      {tools.map((tool) => (
        <AgentActionRow
          key={tool.key}
          tool={tool}
          checked={selected.includes(tool.key)}
          onToggle={(value) => onToggle([tool.key], value)}
        />
      ))}
    </div>
  );

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div className="flex items-center gap-1">
        <CollapsibleTrigger className="flex h-10 min-w-0 flex-1 items-center gap-3 rounded-md px-2 text-start hover:bg-muted/50">
          <ChevronRight
            className={`size-4 shrink-0 text-muted-foreground/60 transition ${open ? 'rotate-90' : 'rtl:rotate-180'}`}
          />
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <span className="shrink-0 text-sm font-medium">{name}</span>
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{summary}</span>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {t('countOf', { on: on.length + alwaysCount, total: all.length })}
          </span>
        </CollapsibleTrigger>
        {optIn.length > 0 ? (
          <MatrixCheckbox
            className="mx-2"
            checked={boxState}
            onCheckedChange={() =>
              onToggle(
                optIn.map((tool) => tool.key),
                !allOn,
              )
            }
            aria-label={t(allOn ? 'turnOffGroup' : 'turnOnGroup', { group: name })}
          />
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="mx-1.5 rounded-sm p-0.5 text-muted-foreground">
                <Lock className="size-3.5" aria-label={t('readOnlyAlwaysOn')} />
              </span>
            </TooltipTrigger>
            <TooltipContent>{t('readOnlyAlwaysOn')}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <CollapsibleContent>
        <div className="space-y-2 ps-9 pt-1 pb-3">
          {shownOptIn.length > 0 && rows(shownOptIn)}
          {shownAlways.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground">
                <Lock className="size-3" />
                {t('alwaysOn')}
              </p>
              {rows(shownAlways)}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
