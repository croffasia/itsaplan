'use client';

import { useState } from 'react';
import { FileText, Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const ICON_SECTIONS = [
  {
    label: 'frequentIcons',
    values: ['📄', '✍️', '📘', '💭', '🧩', '🚀', '✅', '📍', '🎯', '🧪', '🗓️', '📊'],
  },
  {
    label: 'objectIcons',
    values: [
      '📣',
      '🗃️',
      '📎',
      '🔗',
      '🔐',
      '🗝️',
      '⚙️',
      '🧰',
      '💻',
      '📱',
      '🎨',
      '🗺️',
      '🔬',
      '🧬',
      '📝',
      '📐',
    ],
  },
  {
    label: 'symbolIcons',
    values: [
      '⭐',
      '❤️',
      '🔥',
      '⚡',
      '✨',
      '🎉',
      '🏁',
      '🚧',
      '⚠️',
      '❓',
      '💬',
      '👀',
      '👍',
      '🌱',
      '🌍',
      '💎',
    ],
  },
] as const;

export default function DocumentIconPicker({
  icon,
  editable,
  onChange,
}: {
  icon: string | null;
  editable: boolean;
  onChange: (icon: string | null) => void;
}) {
  const t = useTranslations('documents');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [customIcon, setCustomIcon] = useState('');
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const sections = ICON_SECTIONS.map((section) => ({
    ...section,
    values:
      normalizedQuery.length === 0 || t(section.label).toLocaleLowerCase().includes(normalizedQuery)
        ? section.values
        : section.values.filter((value) => value.includes(query.trim())),
  })).filter((section) => section.values.length > 0);
  const iconContent = icon ? (
    <span className="text-[1.65rem] leading-none" aria-hidden>
      {icon}
    </span>
  ) : (
    <FileText className="size-5" />
  );

  if (!editable) {
    return (
      <div
        className="grid size-11 shrink-0 place-items-center text-muted-foreground"
        aria-label={t('pageIcon')}
      >
        {iconContent}
      </div>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery('');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0 rounded-lg text-muted-foreground hover:bg-muted"
          aria-label={t('changeIcon')}
          title={t('changeIcon')}
        >
          {iconContent}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-76 p-2 shadow-xl">
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            className="h-8 border-transparent bg-muted/60 ps-8 text-xs shadow-none focus-visible:bg-background"
            placeholder={t('searchIcons')}
            aria-label={t('searchIcons')}
            autoFocus
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div
          className="max-h-64 overflow-y-auto overscroll-contain pe-1"
          aria-label={t('pageIcon')}
        >
          {sections.map((section) => (
            <section key={section.label} className="mb-2 last:mb-0">
              <h2 className="px-1.5 py-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                {t(section.label)}
              </h2>
              <div className="grid grid-cols-8 gap-0.5">
                {section.values.map((candidate) => (
                  <button
                    key={candidate}
                    type="button"
                    className={cn(
                      'grid size-8 place-items-center rounded-md text-lg transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring',
                      icon === candidate && 'bg-accent ring-1 ring-border',
                    )}
                    aria-label={candidate}
                    aria-pressed={icon === candidate}
                    onClick={() => {
                      onChange(candidate);
                      setOpen(false);
                    }}
                  >
                    {candidate}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>

        <form
          className="mt-2 flex gap-1.5 border-t pt-2"
          onSubmit={(event) => {
            event.preventDefault();
            const nextIcon = customIcon.trim();
            if (!nextIcon) return;
            onChange(nextIcon);
            setCustomIcon('');
            setOpen(false);
          }}
        >
          <Input
            value={customIcon}
            className="h-8 min-w-0 text-xs shadow-none"
            maxLength={8}
            placeholder={t('customIcon')}
            aria-label={t('customIcon')}
            onChange={(event) => setCustomIcon(event.target.value)}
          />
          <Button type="submit" variant="secondary" size="sm" disabled={!customIcon.trim()}>
            {t('setIcon')}
          </Button>
        </form>

        {icon && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1.5 w-full justify-start text-muted-foreground"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            <X />
            {t('removeIcon')}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
