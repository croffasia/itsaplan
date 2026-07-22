import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { IntegrationIcon } from '../integrations/IntegrationIcon';
import type { ToolOption } from './ToolConfigDialog';

// Step one of adding a tool: pick the tool. The catalog tools are grouped by their
// integration (Jina, Firecrawl, Telegram) in a full-width searchable list, matching the
// integration picker. Selecting a tool advances to the credential step.
export function ToolPicker({
  options,
  onSelect,
}: {
  options: ToolOption[];
  onSelect: (toolKey: string) => void;
}) {
  const [query, setQuery] = useState('');

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

  // The distinct integrations present in the matches, in first-seen catalog order.
  const groups = useMemo(() => {
    const seen: string[] = [];
    for (const o of matches) if (!seen.includes(o.integrationKey)) seen.push(o.integrationKey);
    return seen;
  }, [matches]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tools"
          className="pl-9"
        />
      </div>

      <div className="max-h-[55vh] space-y-5 overflow-y-auto pr-1">
        {matches.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No tool matches “{query.trim()}”.
          </p>
        )}
        {groups.map((integrationKey) => {
          const items = matches.filter((o) => o.integrationKey === integrationKey);
          const integrationLabel = items[0].integrationLabel;
          return (
            <div key={integrationKey} className="space-y-1.5">
              <div className="flex items-center gap-2 px-1">
                <IntegrationIcon
                  integration={{ label: integrationLabel, kind: 'tool' }}
                  className="size-5"
                />
                <h3 className="text-xs font-semibold tracking-wide text-foreground uppercase">
                  {integrationLabel}
                </h3>
              </div>
              <div className="space-y-1">
                {items.map((o) => (
                  <button
                    key={o.toolKey}
                    type="button"
                    onClick={() => onSelect(o.toolKey)}
                    className="block w-full rounded-lg border border-transparent px-3 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <span className="block text-sm font-medium text-foreground">{o.label}</span>
                    <span className="block text-xs text-muted-foreground">{o.description}</span>
                    {o.scopes.length > 0 && (
                      <span className="mt-1.5 flex flex-wrap items-center gap-1">
                        <span className="text-[10px] tracking-wide text-muted-foreground uppercase">
                          Scopes
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
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
