import { useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import type { WidgetType } from '@/utils/dashboardWidgets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { WIDGET_GROUPS, WIDGET_META } from '../utils/widgetCatalog';

// Picks a widget type from the catalog and adds it to the current dashboard. Widgets
// are grouped by subject and filtered by a case-insensitive search over the label and
// description, matching the tool picker and GitHub skill import dialogs.
export default function AddWidgetDialog({ onAdd }: { onAdd: (type: WidgetType) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Each group's types narrowed to the ones matching the query; empty groups are
  // dropped so only relevant sections render.
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return WIDGET_GROUPS.map((g) => ({
      label: g.label,
      types: q
        ? g.types.filter((t) => {
            const meta = WIDGET_META[t];
            return (
              meta.label.toLowerCase().includes(q) || meta.description.toLowerCase().includes(q)
            );
          })
        : g.types,
    })).filter((g) => g.types.length > 0);
  }, [query]);

  function add(type: WidgetType) {
    onAdd(type);
    setOpen(false);
    setQuery('');
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-4" /> Add widget
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a widget</DialogTitle>
          <DialogDescription>Pick a widget to add to this dashboard.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search widgets"
            className="pr-9 pl-9"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded-sm text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="max-h-[55vh] space-y-5 overflow-y-auto pr-1">
          {groups.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No widget matches &ldquo;{query.trim()}&rdquo;.
            </p>
          )}
          {groups.map((group) => (
            <div key={group.label} className="space-y-1.5">
              <h3 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {group.label}
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {group.types.map((type) => {
                  const meta = WIDGET_META[type];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => add(type)}
                      className="flex items-start gap-3 rounded-lg border border-transparent bg-muted/20 p-3 text-left transition-colors hover:border-border hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{meta.label}</span>
                        <span className="block text-xs text-muted-foreground">
                          {meta.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
