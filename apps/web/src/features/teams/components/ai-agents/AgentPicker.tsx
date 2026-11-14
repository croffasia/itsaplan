import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { groupInOrder } from '../../utils/agentForm';
import { AgentItemInfo } from './AgentItemInfo';
import { AgentListSearch } from './AgentListSearch';
import type { AgentPickItem } from './AgentPickList';

// Every item a section offers, by group, each with a box that turns it on or off for the agent
// and, when it has one, its description behind an "i". Select all and Clear all act on what
// the search leaves. `footer` holds the ways to add an item the team does not have yet.
export function AgentPicker({
  items,
  selected,
  onToggle,
  searchPlaceholder,
  footer,
}: {
  items: AgentPickItem[];
  selected: number[];
  onToggle: (ids: number[], on: boolean) => void;
  searchPlaceholder: string;
  footer?: ReactNode;
}) {
  const t = useTranslations('teams.agents');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const matches = items.filter(
    (item) =>
      !q ||
      [item.name, item.group, item.note, item.description, item.search].some((text) =>
        text?.toLowerCase().includes(q),
      ),
  );
  const groups = groupInOrder(matches, (item) => item.group ?? '');
  const ids = matches.map((item) => item.id);

  return (
    <div className="flex flex-col">
      <div className="space-y-1 p-1">
        <AgentListSearch value={query} onChange={setQuery} placeholder={searchPlaceholder} />
        {matches.length > 1 && (
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              disabled={ids.every((id) => selected.includes(id))}
              onClick={() => onToggle(ids, true)}
            >
              {t('selectAll')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              disabled={!ids.some((id) => selected.includes(id))}
              onClick={() => onToggle(ids, false)}
            >
              {t('clearAll')}
            </Button>
          </div>
        )}
      </div>
      <div className="max-h-80 overflow-y-auto px-1 pb-1">
        {groups.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            {t('noMatch', { query: query.trim() })}
          </p>
        )}
        {groups.map(([group, members], index) => (
          <div key={group} className={index > 0 ? 'mt-1 border-t border-border/60 pt-1' : ''}>
            {group && (
              <div className="flex items-center gap-2 p-2">
                {members[0].icon?.('size-4 rounded-sm')}
                <span className="truncate text-xs font-medium text-muted-foreground">{group}</span>
              </div>
            )}
            {members.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-sm pe-2 text-sm hover:bg-accent"
              >
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 py-1.5 ps-2">
                  <Checkbox
                    checked={selected.includes(item.id)}
                    onCheckedChange={(on) => onToggle([item.id], on === true)}
                  />
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  {item.warning && (
                    <span className="shrink-0 text-xs font-medium text-warning">
                      {item.warning}
                    </span>
                  )}
                </label>
                {item.description && (
                  <AgentItemInfo name={item.name} description={item.description} />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      {footer}
    </div>
  );
}
