import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { ToolOption } from '../../utils/toolCatalog';

// Selects the given tools, or clears them once all are selected.
export function ToolSelectAllButton({
  tools,
  selected,
  onToggle,
  className,
}: {
  tools: ToolOption[];
  selected: string[];
  onToggle: (toolKeys: string[], on: boolean) => void;
  className?: string;
}) {
  const t = useTranslations('teams.tools');
  if (tools.length === 0) return null;
  const allSelected = tools.every((o) => selected.includes(o.toolKey));
  return (
    <button
      type="button"
      onClick={() =>
        onToggle(
          tools.map((o) => o.toolKey),
          !allSelected,
        )
      }
      className={cn(
        'shrink-0 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground',
        className,
      )}
    >
      {allSelected ? t('clearGroup') : t('selectGroup')}
    </button>
  );
}
