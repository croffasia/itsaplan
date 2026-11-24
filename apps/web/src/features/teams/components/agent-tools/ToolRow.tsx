import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { ToolOption } from '../../utils/toolCatalog';

// One tool of an integration: its name with the description below.
export function ToolRow({
  tool,
  selectable,
  checked,
  added,
  onToggle,
}: {
  tool: ToolOption;
  // False when the integration has no credential to add the tool on.
  selectable: boolean;
  checked: boolean;
  // Already configured on the chosen credential, so it cannot be added again.
  added: boolean;
  onToggle: (on: boolean) => void;
}) {
  const t = useTranslations('teams.tools');
  const Row = selectable ? 'label' : 'div';
  return (
    <Row
      className={cn(
        'flex items-start gap-2.5 rounded-md px-2 py-2 transition-colors',
        added && 'opacity-60',
        selectable && !added && 'cursor-pointer hover:bg-muted/60',
        checked && !added && 'bg-muted/40',
      )}
    >
      {selectable && (
        <Checkbox
          className="mt-0.5"
          disabled={added}
          checked={added || checked}
          onCheckedChange={(v) => onToggle(v === true)}
        />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{tool.name}</span>
        <span className="block text-xs text-muted-foreground">{tool.description}</span>
      </span>
      {added && (
        <Badge variant="secondary" className="shrink-0 text-[10px] font-normal">
          {t('added')}
        </Badge>
      )}
    </Row>
  );
}
