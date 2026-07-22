import type { IntegrationMeta } from '@/lib/api';
import { cn } from '@/lib/utils';

// A small square monogram for an integration: the first one or two letters of its
// label. The catalog has no per-integration artwork and there are ~150 LLM providers,
// so a monogram is the compact, uniform stand-in.
function monogram(label: string): string {
  const cleaned = label.replace(/[^A-Za-z0-9]/g, '');
  return (cleaned.slice(0, 2) || label.slice(0, 2)).toUpperCase();
}

export function IntegrationIcon({
  integration,
  className = 'size-9',
}: {
  integration: Pick<IntegrationMeta, 'label' | 'kind'>;
  className?: string;
}) {
  const tint =
    integration.kind === 'llm' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground';
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg text-xs font-semibold',
        tint,
        className,
      )}
    >
      {monogram(integration.label)}
    </div>
  );
}
