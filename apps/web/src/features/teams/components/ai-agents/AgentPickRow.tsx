import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AgentPickItem } from './AgentPickList';

// An item turned on for the agent. The button that turns it off shows on hover where there is
// a pointer to hover with, and stays visible on touch screens.
export function AgentPickRow({
  item,
  removeLabel,
  onRemove,
}: {
  item: AgentPickItem;
  removeLabel: string;
  onRemove: () => void;
}) {
  return (
    <div className="group/item flex min-h-9 items-center gap-3 rounded-md px-2 py-1 hover:bg-muted/50">
      {item.icon?.('size-6 rounded-md')}
      <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
      {(item.warning || item.note) && (
        <span
          className={`shrink-0 truncate text-xs ${item.warning ? 'font-medium text-warning' : 'text-muted-foreground'}`}
        >
          {item.warning ?? item.note}
        </span>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground focus-visible:opacity-100 pointer-fine:opacity-0 pointer-fine:group-hover/item:opacity-100"
        aria-label={removeLabel}
        onClick={onRemove}
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
