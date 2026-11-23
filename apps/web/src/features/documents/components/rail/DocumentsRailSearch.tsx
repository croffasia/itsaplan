'use client';

import { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { isTypingTarget } from '@/utils/hotkeys';
import { useDocumentsRail } from '../../context/documentsRail';

const NARROW = '(max-width: 767px)';

// `/` focuses the search from anywhere on the Docs page, opening the drawer on a narrow screen.
// It stays out of the hotkey registry: a binding there records letters and digits only.
export default function DocumentsRailSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations('documents');
  const openRail = useDocumentsRail()?.setOpen;
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.defaultPrevented || isTypingTarget(event.target)) return;
      if ((event.target as Element | null)?.closest?.('[role="dialog"], [role="menu"]')) return;
      event.preventDefault();
      if (window.matchMedia(NARROW).matches) openRail?.(true);
      // The drawer becomes visible on the next render.
      requestAnimationFrame(() => input.current?.focus());
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openRail]);

  return (
    <label className="relative mx-3 mt-1 mb-2 block shrink-0">
      <span className="sr-only">{t('searchLabel')}</span>
      <Search
        className="pointer-events-none absolute start-2.25 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        ref={input}
        type="search"
        value={value}
        autoComplete="off"
        placeholder={t('search')}
        className="peer h-8 border-transparent bg-muted/80 ps-7.5 pe-8 shadow-none hover:bg-muted focus-visible:border-input focus-visible:bg-background focus-visible:ring-0"
        onChange={(event) => onChange(event.target.value)}
      />
      <kbd
        className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 rounded bg-background px-1.25 py-0.75 font-sans text-[11px] leading-none font-medium text-muted-foreground ring-1 ring-border peer-focus:hidden"
        aria-hidden
      >
        /
      </kbd>
    </label>
  );
}
