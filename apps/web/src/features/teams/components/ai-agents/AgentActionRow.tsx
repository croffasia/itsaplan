import type { AgentTool } from '@/lib/api/endpoints/agents';
import { Checkbox } from '@/components/ui/checkbox';
import { AgentItemInfo } from './AgentItemInfo';

// One action in an open group of the Actions section, with what it does behind an "i". A
// read-only action is always granted, so its box is checked and cannot be cleared.
export function AgentActionRow({
  tool,
  checked,
  onToggle,
}: {
  tool: AgentTool;
  checked: boolean;
  onToggle: (on: boolean) => void;
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-2 rounded-sm pe-2 ${tool.always ? '' : 'hover:bg-muted/50'}`}
    >
      <label
        className={`flex min-w-0 flex-1 items-center gap-2.5 py-1.5 ps-2 text-sm ${tool.always ? 'text-muted-foreground' : 'cursor-pointer'}`}
      >
        <Checkbox
          checked={tool.always || checked}
          disabled={tool.always}
          onCheckedChange={(v) => onToggle(v === true)}
        />
        <span className="min-w-0 truncate">{tool.label}</span>
      </label>
      <AgentItemInfo name={tool.label} description={tool.description} />
    </div>
  );
}
