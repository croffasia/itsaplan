import { Code } from 'lucide-react';
import { IntegrationIcon } from '@/components/common/IntegrationIcon';
import { cn } from '@/lib/utils';
import type { AgentToolView } from '../../hooks/useAgentToolViews';

// The square in front of a tool in the agent editor: its integration's mark, or a code
// sign for a tool the team made itself, which has no integration.
export function AgentToolIcon({ view, className }: { view: AgentToolView; className: string }) {
  if (!view.tool.source)
    return <IntegrationIcon integration={view.integration} className={className} />;
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground',
        className,
      )}
    >
      <Code className="size-[58%]" />
    </div>
  );
}
