import { IntegrationIcon } from '@/components/common/IntegrationIcon';
import { cn } from '@/lib/utils';
import type { ToolIntegrationEntry } from '../../hooks/useAddTools';

// One titled group of integrations in the add-tool dialog's list. Each row shows how
// many tools the integration offers, or how many of them are selected.
export function ToolRailSection({
  title,
  entries,
  activeKey,
  onOpen,
}: {
  title: string;
  entries: ToolIntegrationEntry[];
  activeKey: string | null;
  onOpen: (integrationKey: string) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <div className="pb-1.5">
      <h3 className="sticky top-0 z-10 flex h-8 items-center gap-1.5 bg-card px-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
        <span className="font-normal tabular-nums">{entries.length}</span>
      </h3>
      <div className="space-y-0.5">
        {entries.map(({ integration, tools, pending }) => {
          const active = integration.key === activeKey;
          return (
            <button
              key={integration.key}
              type="button"
              aria-current={active}
              onClick={() => onOpen(integration.key)}
              className={cn(
                'flex h-9 w-full items-center gap-2 rounded-md px-2 text-start text-sm transition-colors',
                active
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              )}
            >
              <IntegrationIcon
                integration={{ ...integration, kind: 'tool' }}
                className="size-6 rounded-md text-[10px]"
              />
              <span className="min-w-0 flex-1 truncate font-medium">{integration.label}</span>
              {pending.length > 0 ? (
                <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground tabular-nums">
                  {pending.length}
                </span>
              ) : (
                <span className="text-xs tabular-nums">{tools.length}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
