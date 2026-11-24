import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { ToolSourceEntry } from '../../types/toolSource';

// The header buttons of the Tools page: the button of each source the team defines tools with,
// then a catalog tool.
export default function ToolAddActions({
  sources,
  onCreate,
  onAdd,
}: {
  sources: ToolSourceEntry[];
  onCreate: (source: string) => void;
  onAdd: () => void;
}) {
  const t = useTranslations('teams.tools');
  return (
    <div className="flex items-center gap-2">
      {sources.map((source) => (
        <source.CreateButton key={source.key} onCreate={() => onCreate(source.key)} />
      ))}
      <Button size="sm" className="h-8 gap-1.5" onClick={onAdd}>
        <Plus className="size-3.5" />
        {t('add')}
      </Button>
    </div>
  );
}
