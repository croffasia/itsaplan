import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useColumnSearchContext } from '../../context/columnSearchContext';

export function ColumnSearchEntry({ groupKey }: { groupKey: string }) {
  const search = useColumnSearchContext();
  const t = useTranslations('workItems.search');
  if (!search.enabled) return null;
  return (
    <Button
      ref={(element) => {
        if (element) search.entryRefs.current.set(groupKey, element);
        else search.entryRefs.current.delete(groupKey);
      }}
      variant="ghost"
      className="mb-2 h-11 w-full shrink-0 justify-start gap-2 text-sm font-normal text-muted-foreground"
      onClick={(event) => {
        event.stopPropagation();
        search.open(groupKey);
      }}
      aria-expanded={search.active?.key === groupKey}
    >
      <Search className="size-4" />
      {t('label')}
    </Button>
  );
}
