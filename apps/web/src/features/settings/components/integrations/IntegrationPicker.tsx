import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { IntegrationMeta } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { IntegrationIcon } from './IntegrationIcon';

// The groups the catalog is split into, in display order. LLM providers first, tool
// integrations second.
const GROUPS: { kind: IntegrationMeta['kind']; title: string; hint: string }[] = [
  { kind: 'llm', title: 'AI providers', hint: 'The model an internal agent runs on' },
  { kind: 'tool', title: 'Tools', hint: 'Integrations an agent can call as tools' },
];

// Step one of adding a credential: pick the integration. The catalog is long (~150 LLM
// providers), so it is a full-width searchable list grouped by kind rather than a
// dropdown. Selecting an integration advances to its credential form.
export function IntegrationPicker({
  catalog,
  onSelect,
}: {
  catalog: IntegrationMeta[];
  onSelect: (key: string) => void;
}) {
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (c) => c.label.toLowerCase().includes(q) || c.key.toLowerCase().includes(q),
    );
  }, [catalog, query]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search integrations"
          className="pl-9"
        />
      </div>

      <div className="max-h-[55vh] space-y-5 overflow-y-auto pr-1">
        {matches.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No integration matches “{query.trim()}”.
          </p>
        )}
        {GROUPS.map(({ kind, title, hint }) => {
          const items = matches.filter((c) => c.kind === kind);
          if (items.length === 0) return null;
          return (
            <div key={kind} className="space-y-1.5">
              <div className="flex items-baseline gap-2 px-1">
                <h3 className="text-xs font-semibold tracking-wide text-foreground uppercase">
                  {title}
                </h3>
                <span className="text-xs text-muted-foreground">{hint}</span>
              </div>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {items.map((integration) => (
                  <button
                    key={integration.key}
                    type="button"
                    onClick={() => onSelect(integration.key)}
                    className="flex items-center gap-3 rounded-lg border border-transparent px-2 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <IntegrationIcon integration={integration} className="size-8" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {integration.label}
                      </span>
                      {integration.tools.length > 0 && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {integration.tools.length}{' '}
                          {integration.tools.length === 1 ? 'tool' : 'tools'}
                        </span>
                      )}
                    </span>
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
