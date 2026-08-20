import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { IntegrationIcon } from '../integrations/IntegrationIcon';
import type { ToolOption } from './ToolConfigDialog';
import { useTranslations } from 'next-intl';

// Step one of adding tools: pick them. The catalog tools are grouped by their
// integration (Jina, Firecrawl, Telegram) in a full-width searchable list, matching the
// integration picker. The selection stays inside one integration because step two binds
// it to a single credential of that integration.
export function ToolPicker({
  options,
  onSubmit,
}: {
  options: ToolOption[];
  onSubmit: (tools: ToolOption[]) => void;
}) {
  const t = useTranslations('settings.tools');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.description.toLowerCase().includes(q) ||
        o.integrationLabel.toLowerCase().includes(q) ||
        o.scopes.some((s) => s.toLowerCase().includes(q)),
    );
  }, [options, query]);

  // The matches split by integration, in first-seen catalog order.
  const groups = useMemo(() => {
    const byIntegration = new Map<string, ToolOption[]>();
    for (const o of matches) {
      const items = byIntegration.get(o.integrationKey);
      if (items) items.push(o);
      else byIntegration.set(o.integrationKey, [o]);
    }
    return [...byIntegration.values()];
  }, [matches]);

  const lockedTo = options.find((o) => o.toolKey === selected[0])?.integrationKey ?? null;

  function toggle(toolKey: string, on: boolean) {
    setSelected((prev) => (on ? [...prev, toolKey] : prev.filter((k) => k !== toolKey)));
  }

  // The group toggle acts on the tools the search leaves on screen, so it never selects
  // a tool the user is not looking at.
  function toggleGroup(items: ToolOption[], allSelected: boolean) {
    const keys = items.map((o) => o.toolKey);
    setSelected((prev) =>
      allSelected ? prev.filter((k) => !keys.includes(k)) : [...new Set([...prev, ...keys])],
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('search')}
          className="ps-9"
        />
      </div>

      <div className="max-h-[55vh] space-y-5 overflow-y-auto pe-1">
        {matches.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t('noMatches', { query: query.trim() })}
          </p>
        )}
        {groups.map((items) => {
          const { integrationKey, integrationLabel } = items[0];
          const disabled = lockedTo != null && lockedTo !== integrationKey;
          const allSelected = items.every((o) => selected.includes(o.toolKey));
          return (
            <div key={integrationKey} className={cn('space-y-1.5', disabled && 'opacity-50')}>
              <div className="flex items-center gap-2 px-1">
                <IntegrationIcon
                  integration={{ label: integrationLabel, kind: 'tool' }}
                  className="size-5"
                />
                <h3 className="text-xs font-semibold tracking-wide text-foreground uppercase">
                  {integrationLabel}
                </h3>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleGroup(items, allSelected)}
                  className="ms-auto text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none"
                >
                  {allSelected ? t('clearGroup') : t('selectGroup')}
                </button>
              </div>
              <div className="space-y-1">
                {items.map((o) => (
                  <label
                    key={o.toolKey}
                    className={cn(
                      'flex w-full items-start gap-2.5 rounded-lg border border-transparent px-3 py-2 transition-colors',
                      disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-muted/60',
                    )}
                  >
                    <Checkbox
                      className="mt-0.5"
                      disabled={disabled}
                      checked={selected.includes(o.toolKey)}
                      onCheckedChange={(v) => toggle(o.toolKey, v === true)}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">{o.label}</span>
                      <span className="block text-xs text-muted-foreground">{o.description}</span>
                      {o.scopes.length > 0 && (
                        <span className="mt-1.5 flex flex-wrap items-center gap-1">
                          <span className="text-[10px] tracking-wide text-muted-foreground uppercase">
                            {t('scopesUpper')}
                          </span>
                          {o.scopes.map((s) => (
                            <Badge
                              key={s}
                              variant="secondary"
                              className="font-mono text-[10px] font-normal"
                            >
                              {s}
                            </Badge>
                          ))}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 border-t pt-3">
        <span className="text-xs text-muted-foreground">
          {selected.length > 0
            ? t('selectedCount', { count: selected.length })
            : t('oneIntegration')}
        </span>
        <Button
          disabled={selected.length === 0}
          onClick={() => onSubmit(options.filter((o) => selected.includes(o.toolKey)))}
        >
          {t('continue')}
        </Button>
      </div>
    </div>
  );
}
