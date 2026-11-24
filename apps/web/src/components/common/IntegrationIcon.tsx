import type { IntegrationMeta } from '@/lib/api/endpoints/integrations';
import { cn } from '@/lib/utils';

// The first one or two letters of an integration's label. There are ~150 AI providers
// and none carries artwork, so a monogram is the compact, uniform stand-in for them.
function monogram(label: string): string {
  const cleaned = label.replace(/[^A-Za-z0-9]/g, '');
  return (cleaned.slice(0, 2) || label.slice(0, 2)).toUpperCase();
}

// A small square for an integration: its brand mark when the catalog carries one (the
// tool integrations), otherwise its monogram.
export function IntegrationIcon({
  integration,
  className = 'size-9',
}: {
  integration: Pick<IntegrationMeta, 'label' | 'kind' | 'icon'>;
  className?: string;
}) {
  const { icon } = integration;
  let tint = 'bg-muted text-muted-foreground';
  if (icon) tint = 'bg-muted text-foreground';
  else if (integration.kind === 'llm') tint = 'bg-primary/10 text-primary';
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg text-xs font-semibold',
        tint,
        className,
      )}
    >
      {icon ? (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[58%]">
          <path d={icon.path} fill={icon.color ?? 'currentColor'} />
        </svg>
      ) : (
        monogram(integration.label)
      )}
    </div>
  );
}
