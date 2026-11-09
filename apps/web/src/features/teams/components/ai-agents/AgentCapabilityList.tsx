import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { groupInOrder } from '../../utils/agentForm';
import { AgentListSearch } from './AgentListSearch';
import { AgentCapabilityHeading } from './AgentCapabilityHeading';
import { AgentCapabilityRow } from './AgentCapabilityRow';

// One selectable capability row (a skill or a configured tool), normalized so the
// list renders skills and tools the same way. `search` is the lowercased haystack the
// filter matches against; `group` is the heading the row sits under, when the list is
// grouped at all.
export interface CapabilityItem {
  id: number;
  checked: boolean;
  title: string;
  subtitle?: string;
  group?: string;
  search: string;
}

// A searchable, height-capped checklist of an agent's capabilities: the enabled ones
// first, then the rest grouped. The list scrolls past a fixed height so a big library
// does not push the rest of the form off screen. Shared by the Skills, Tools and
// Projects sections of the agent form.
export function AgentCapabilityList({
  items,
  onToggle,
  searchPlaceholder,
}: {
  items: CapabilityItem[];
  onToggle: (ids: number[], on: boolean) => void;
  searchPlaceholder: string;
}) {
  const t = useTranslations('teams.agents');
  const [query, setQuery] = useState('');

  const { enabled, groups } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q ? items.filter((i) => i.search.includes(q)) : items;
    return {
      enabled: matches.filter((i) => i.checked),
      groups: groupInOrder(
        matches.filter((i) => !i.checked),
        (i) => i.group ?? '',
      ),
    };
  }, [items, query]);

  const ids = (list: CapabilityItem[]) => list.map((i) => i.id);

  return (
    <div className="space-y-2">
      <AgentListSearch value={query} onChange={setQuery} placeholder={searchPlaceholder} />

      <div className="max-h-80 space-y-4 overflow-y-auto pe-1">
        {enabled.length === 0 && groups.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            {t('noMatch', { query: query.trim() })}
          </p>
        )}

        {enabled.length > 0 && (
          <div className="space-y-1">
            <AgentCapabilityHeading
              label={t('enabled')}
              count={enabled.length}
              action={t('clearAll')}
              onAction={() => onToggle(ids(enabled), false)}
            />
            {enabled.map((item) => (
              <AgentCapabilityRow key={item.id} item={item} onToggle={onToggle} />
            ))}
          </div>
        )}

        {groups.length > 0 && (
          <div className="space-y-3">
            <AgentCapabilityHeading
              label={t('available')}
              count={groups.reduce((n, [, g]) => n + g.length, 0)}
              // Each named group carries its own select-all, so the block only needs
              // one when its items are ungrouped (the first group then has no name).
              action={groups[0][0] ? undefined : t('selectAll')}
              onAction={() => onToggle(ids(groups.flatMap(([, g]) => g)), true)}
            />
            {groups.map(([group, groupItems]) => (
              <div key={group} className="space-y-1">
                {group && (
                  <div className="flex items-center gap-2 py-1">
                    <span className="text-xs font-medium text-muted-foreground">{group}</span>
                    <button
                      type="button"
                      className="ms-auto text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => onToggle(ids(groupItems), true)}
                    >
                      {t('selectAll')}
                    </button>
                  </div>
                )}
                {groupItems.map((item) => (
                  <AgentCapabilityRow key={item.id} item={item} onToggle={onToggle} />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
