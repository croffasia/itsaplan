import { Lock, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { PRO_URL } from '@/utils/app';
import type { ToolSourceEntry } from '../../types/toolSource';

// The header buttons of the Tools page: a new tool of each source the team defines tools with,
// a locked one leading to the page about the edition that has it, then a catalog tool.
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
      {sources.map((source) =>
        source.kind === 'source' ? (
          <Button
            key={source.key}
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5"
            onClick={() => onCreate(source.key)}
          >
            <Plus className="size-3.5" />
            {source.label}
          </Button>
        ) : (
          <Button key={source.key} size="sm" variant="ghost" className="h-8 gap-1.5" asChild>
            <a href={PRO_URL} target="_blank" rel="noreferrer" title={source.hint}>
              <Lock className="size-3.5" />
              {source.label}
            </a>
          </Button>
        ),
      )}
      <Button size="sm" className="h-8 gap-1.5" onClick={onAdd}>
        <Plus className="size-3.5" />
        {t('add')}
      </Button>
    </div>
  );
}
