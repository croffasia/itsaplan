import { useTranslations } from 'next-intl';
import type { AgentTool } from '@/lib/api/endpoints/agents';
import { Checkbox } from '@/components/ui/checkbox';
import NeedsProLink from '@/components/common/NeedsProLink';
import { AgentItemInfo } from './AgentItemInfo';

// One action in an open group of the Actions section, with what it does behind an "i". A
// read-only action is always granted, so its box is checked and cannot be cleared. A locked
// one is an edition's: its box can be cleared, not checked.
export function AgentActionRow({
  tool,
  checked,
  onToggle,
}: {
  tool: AgentTool;
  checked: boolean;
  onToggle: (on: boolean) => void;
}) {
  const t = useTranslations('teams.tools');
  const alwaysOn = tool.always && !tool.locked;
  return (
    <div
      className={`flex min-w-0 items-center gap-2 rounded-sm pe-2 ${tool.always ? '' : 'hover:bg-muted/50'}`}
    >
      <label
        className={`flex min-w-0 flex-1 items-center gap-2.5 py-1.5 ps-2 text-sm ${tool.always ? 'text-muted-foreground' : 'cursor-pointer'}`}
      >
        <Checkbox
          checked={alwaysOn || checked}
          disabled={tool.always || (tool.locked && !checked)}
          onCheckedChange={(v) => onToggle(v === true)}
        />
        <span className="min-w-0 truncate">{tool.label}</span>
      </label>
      {tool.locked && (
        <NeedsProLink
          feature="agent-actions"
          label={t('locked')}
          hint={t('lockedHint')}
          className="shrink-0"
        />
      )}
      <AgentItemInfo name={tool.label} description={tool.description} />
    </div>
  );
}
