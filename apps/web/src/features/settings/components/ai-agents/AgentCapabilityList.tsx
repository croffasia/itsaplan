import { useMemo, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { useTranslations } from 'next-intl';
import { groupInOrder } from '../../utils/agentForm';
import { AgentListSearch, SEARCH_THRESHOLD } from './AgentListSearch';

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

// A searchable, height-capped checklist of an agent's capabilities. The list scrolls
// past a fixed height so a big library does not push the rest of the form off screen.
// Shared by the Skills and Tools sections of the agent form.
export function AgentCapabilityList({
  items,
  onToggle,
  searchPlaceholder,
}: {
  items: CapabilityItem[];
  onToggle: (id: number, on: boolean) => void;
  searchPlaceholder: string;
}) {
  const t = useTranslations('settings.agents');
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q ? items.filter((i) => i.search.includes(q)) : items;
    return groupInOrder(matches, (i) => i.group ?? '');
  }, [items, query]);

  return (
    <div className="space-y-2">
      {items.length > SEARCH_THRESHOLD && (
        <AgentListSearch value={query} onChange={setQuery} placeholder={searchPlaceholder} />
      )}

      <div className="max-h-72 space-y-4 overflow-y-auto pe-1">
        {groups.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            {t('noMatch', { query: query.trim() })}
          </p>
        ) : (
          groups.map(([group, groupItems]) => (
            <div key={group} className="space-y-1.5">
              {group && (
                <p className="text-xs font-medium tracking-wide text-muted-foreground">{group}</p>
              )}
              {groupItems.map((item) => (
                <label key={item.id} className="flex cursor-pointer items-start gap-2">
                  <Checkbox
                    className="mt-0.5"
                    checked={item.checked}
                    onCheckedChange={(v) => onToggle(item.id, v === true)}
                  />
                  <span>
                    <span className="text-sm">{item.title}</span>
                    {item.subtitle && (
                      <span className="block text-xs text-muted-foreground">{item.subtitle}</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
