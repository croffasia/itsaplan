import { LayoutGrid } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { ToolSourceEntry } from '../../types/toolSource';

// The ways to add a tool to the team from the agent editor: the catalog, then the button of
// each source the team makes tools with. A source this edition lacks draws its own button,
// which says where it is available.
export function AgentToolAddActions({
  sources,
  onAdd,
  onCreate,
  className,
}: {
  sources: ToolSourceEntry[];
  onAdd: () => void;
  onCreate: (source: string) => void;
  className: string;
}) {
  const t = useTranslations('teams.agents');
  return (
    <div className={className}>
      <Button type="button" size="sm" variant="ghost" className="h-8 gap-1.5" onClick={onAdd}>
        <LayoutGrid className="size-3.5" />
        {t('addFromCatalog')}
      </Button>
      {sources.map((source) => (
        <source.CreateButton key={source.key} onCreate={() => onCreate(source.key)} />
      ))}
    </div>
  );
}
