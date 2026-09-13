import { useId } from 'react';
import { Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useColumnSearchContext } from '../../context/columnSearchContext';
import { ColumnSearchSummary } from './ColumnSearchSummary';

export function ColumnSearchControl() {
  const search = useColumnSearchContext();
  const t = useTranslations('workItems.search');
  const id = useId();
  const composing = search.composing;
  const clear = () => {
    search.changeQuery('');
    search.draft.scrollTop = 0;
    search.inputRef.current?.focus();
  };
  return (
    <div className="shrink-0 space-y-2 px-1 pb-3">
      <label htmlFor={id} className="block text-sm font-medium">
        {t('label')}
      </label>
      <div className="flex items-center gap-1">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute start-3 top-3.5 size-4 text-muted-foreground"
          />
          <Input
            ref={search.inputRef}
            id={id}
            type="search"
            value={search.query}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            aria-describedby={`${id}-context`}
            placeholder={t('placeholder')}
            dir="auto"
            className="h-11 min-w-0 border-0 bg-background ps-9 pe-2 text-base shadow-none md:text-base [&::-webkit-search-cancel-button]:hidden"
            onChange={(event) => search.changeQuery(event.target.value, !composing.current)}
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={(event) => {
              composing.current = false;
              search.changeQuery(event.currentTarget.value);
            }}
            onKeyDown={(event) => {
              if (composing.current || event.nativeEvent.isComposing) {
                event.stopPropagation();
                return;
              }
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                search.resultsRef.current?.focusIndex(0);
              }
              if (event.key === 'Enter') {
                event.preventDefault();
                if (search.active?.mode === 'modal') event.currentTarget.blur();
              }
              if (event.key === 'Escape' && search.active?.mode === 'inline') {
                event.preventDefault();
                event.stopPropagation();
                if (search.query) clear();
                else search.close();
              }
            }}
          />
        </div>
        {search.query && (
          <Button
            variant="ghost"
            size="icon"
            className="size-11 shrink-0"
            aria-label={t('clear')}
            onClick={clear}
          >
            <X />
          </Button>
        )}
        {search.active?.mode === 'inline' && (
          <Button
            variant="ghost"
            size="icon"
            className="size-11 shrink-0"
            aria-label={t('close')}
            onClick={() => search.close()}
          >
            <X />
          </Button>
        )}
      </div>
      <ColumnSearchSummary id={`${id}-context`} />
    </div>
  );
}
