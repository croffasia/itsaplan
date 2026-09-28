import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useColumnSearchContext } from '../../context/columnSearchContext';

export function ColumnSearchEntry({ groupKey }: { groupKey: string }) {
  const search = useColumnSearchContext();
  const t = useTranslations('workItems.search');
  if (!search.enabled) return null;
  const open = search.active?.key === groupKey;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          ref={(element) => {
            if (element) search.entryRefs.current.set(groupKey, element);
            else search.entryRefs.current.delete(groupKey);
          }}
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground"
          aria-label={t('label')}
          aria-expanded={open}
          onMouseDown={(event) => {
            // Keeps focus in the search field, whose blur would otherwise close an empty
            // search before this click toggles it.
            if (open) event.preventDefault();
          }}
          onClick={(event) => {
            event.stopPropagation();
            if (open) search.close();
            else search.open(groupKey);
          }}
        >
          <Search />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t('label')}</TooltipContent>
    </Tooltip>
  );
}
