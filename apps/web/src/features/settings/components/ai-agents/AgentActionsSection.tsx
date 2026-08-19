'use client';

import { useMemo, useState } from 'react';
import { ListChecks } from 'lucide-react';
import type { AgentTool } from '@/lib/api';
import { grantedToolCount, groupInOrder } from '../../utils/agentForm';
import { AgentFormSection } from './AgentFormSection';
import { AgentActionRow } from './AgentActionRow';
import { AgentListSearch, SEARCH_THRESHOLD } from './AgentListSearch';
import { useTranslations } from 'next-intl';

// What the agent may do in the project, grouped by the feature each action belongs to
// and filterable by label and description. Read-only actions are always granted; the
// rest are opt-in. The counter shows the tools the agent actually has (the granted ones
// plus the always-on read tools) over the full catalog.
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
  const t = useTranslations('settings.agents');
  const [query, setQuery] = useState('');
  const activeCount = grantedToolCount(tools, selected);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter((tool) => `${tool.label} ${tool.description}`.toLowerCase().includes(q));
  }, [tools, query]);

  const groups = useMemo(() => groupInOrder(matches, (tool) => tool.group), [matches]);

  // The bulk toggle acts on the opt-in actions the filter leaves on screen, so it never
  // grants an action the user is not looking at.
  const shown = matches.filter((tool) => !tool.always);
  const allShownGranted = shown.length > 0 && shown.every((tool) => selected.includes(tool.key));

  function toggleShown() {
    const next = new Set(selected);
    for (const tool of shown) {
      if (allShownGranted) next.delete(tool.key);
      else next.add(tool.key);
    }
    onChange([...next]);
  }

  function toggleTool(key: string, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(key);
    else next.delete(key);
    onChange([...next]);
  }

  return (
    <AgentFormSection
      id="actions"
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
        <>
          <div className="flex items-center justify-end gap-3">
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
                onClick={toggleShown}
                className="shrink-0 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {allShownGranted ? t('clearAll') : t('selectAll')}
              </button>
            )}
          </div>

          {groups.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              {t('noMatch', { query: query.trim() })}
            </p>
          ) : (
            groups.map(([group, groupTools]) => (
              <div key={group} className="space-y-2.5">
                <p className="text-xs font-medium tracking-wide text-muted-foreground">
                  {t(`actionGroup.${group}`)}
                </p>
                <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                  {groupTools.map((tool) => (
                    <AgentActionRow
                      key={tool.key}
                      tool={tool}
                      checked={selected.includes(tool.key)}
                      onToggle={(on) => toggleTool(tool.key, on)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </>
      )}
    </AgentFormSection>
  );
}
