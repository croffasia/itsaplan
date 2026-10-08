import { useId } from 'react';
import { Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
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
  const closes = !search.query && search.active?.mode === 'inline';
  const dismiss = () => (closes ? search.close() : clear());
  return (
    <div className="shrink-0 space-y-2 px-1 pb-3">
      <label htmlFor={id} className="sr-only">
        {t('label')}
      </label>
      <InputGroup
        className="h-8 bg-background transition-[color,box-shadow,border-color] duration-150 motion-reduce:transition-none pointer-coarse:h-10"
        onBlur={(event) => {
          const next = event.relatedTarget;
          if (search.query || search.active?.mode !== 'inline') return;
          // Leaving the window also blurs with no target; that keeps the search open.
          if (next ? event.currentTarget.closest('section')?.contains(next) : !document.hasFocus())
            return;
          search.close(false);
        }}
      >
        <InputGroupAddon>
          <Search aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
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
          className="h-full text-sm md:text-sm pointer-coarse:text-base [&::-webkit-search-cancel-button]:hidden"
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
              dismiss();
            }
          }}
        />
        {(search.query || closes) && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              className="pointer-coarse:size-8"
              aria-label={closes ? t('close') : t('clear')}
              onClick={dismiss}
            >
              <X />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>
      <ColumnSearchSummary id={`${id}-context`} />
    </div>
  );
}
