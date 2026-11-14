'use client';

import { useMemo, useState } from 'react';
import { ListChecks } from 'lucide-react';
import type { AgentTool } from '@/lib/api/endpoints/agents';
import { grantedToolCount, groupInOrder } from '../../utils/agentForm';
import { AgentFormSection } from './AgentFormSection';
import { AgentActionGroup } from './AgentActionGroup';
import { AgentListSearch, SEARCH_THRESHOLD } from './AgentListSearch';
import { useTranslations } from 'next-intl';

// What the agent may do in the project, grouped by the feature each action belongs to and
// filterable by label and description. The groups start folded, each saying what of it the
// agent has; a search opens the groups it finds actions in. Read-only actions are always
// granted; the rest are opt-in. The counter shows the tools the agent actually has (the
// granted ones plus the always-on read tools) over the full catalog. An action also has to
// be permitted by the agent's role in the project it runs in, which each project's member
// list sets.
export default function AgentActionsSection({
  open,
  onOpenChange,
  tools,
  toolsLoading,
  selected,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tools: AgentTool[];
  toolsLoading: boolean;
  selected: string[];
  onChange: (keys: string[]) => void;
}) {
  const t = useTranslations('teams.agents');
  const [query, setQuery] = useState('');
  const [openGroups, setOpenGroups] = useState<Partial<Record<AgentTool['group'], boolean>>>({});
  const activeCount = grantedToolCount(tools, selected);
  const searching = query.trim() !== '';

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter((tool) => `${tool.label} ${tool.description}`.toLowerCase().includes(q));
  }, [tools, query]);

  const groups = useMemo(() => groupInOrder(tools, (tool) => tool.group), [tools]);
  const shownGroups = groups
    .map(([group, all]) => ({ group, all, shown: matches.filter((tool) => tool.group === group) }))
    .filter(({ shown }) => shown.length > 0);

  // The bulk toggle acts on the opt-in actions the filter leaves on screen, so it never
  // grants an action the user is not looking at.
  const shown = matches.filter((tool) => !tool.always);
  const allShownGranted = shown.length > 0 && shown.every((tool) => selected.includes(tool.key));

  function toggle(keys: string[], on: boolean) {
    const next = new Set(selected);
    for (const key of keys) {
      if (on) next.add(key);
      else next.delete(key);
    }
    onChange([...next]);
  }

  return (
    <AgentFormSection
      open={open}
      onOpenChange={onOpenChange}
      icon={ListChecks}
      title={t('actions')}
      hint={t('actionsHint')}
      headerRight={tools.length > 0 ? `${activeCount} / ${tools.length}` : undefined}
    >
      {toolsLoading && <p className="text-xs text-muted-foreground">{t('loadingActions')}</p>}
      {!toolsLoading && tools.length === 0 && (
        <p className="text-xs text-muted-foreground">{t('noActions')}</p>
      )}
      {!toolsLoading && tools.length > 0 && (
        <div>
          <div className="flex items-center justify-end gap-3 border-b border-border/60 pb-4">
            {tools.length > SEARCH_THRESHOLD && (
              <div className="min-w-0 flex-1">
                <AgentListSearch
                  value={query}
                  onChange={setQuery}
                  placeholder={t('searchActions')}
                />
              </div>
            )}
            {shown.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  toggle(
                    shown.map((tool) => tool.key),
                    !allShownGranted,
                  )
                }
                className="shrink-0 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {allShownGranted ? t('clearAll') : t('selectAll')}
              </button>
            )}
          </div>

          {shownGroups.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              {t('noMatch', { query: query.trim() })}
            </p>
          ) : (
            <div className="divide-y divide-border/40 pt-2">
              {shownGroups.map(({ group, all, shown: groupShown }) => (
                <div key={group} className="py-1">
                  <AgentActionGroup
                    group={group}
                    all={all}
                    shown={groupShown}
                    selected={selected}
                    onToggle={toggle}
                    open={searching || !!openGroups[group]}
                    onOpenChange={(next) => setOpenGroups((prev) => ({ ...prev, [group]: next }))}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </AgentFormSection>
  );
}
