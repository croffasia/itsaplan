'use client';

import type { Editor } from '@tiptap/react';
import { Check, Palette } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const COLORS = [
  { value: null, surface: 'bg-foreground', ink: 'text-background' },
  { value: '#dc2626', surface: 'bg-red-600', ink: 'text-white' },
  { value: '#ea580c', surface: 'bg-orange-600', ink: 'text-white' },
  { value: '#ca8a04', surface: 'bg-yellow-600', ink: 'text-white' },
  { value: '#16a34a', surface: 'bg-green-600', ink: 'text-white' },
  { value: '#2563eb', surface: 'bg-blue-600', ink: 'text-white' },
  { value: '#7c3aed', surface: 'bg-violet-600', ink: 'text-white' },
  { value: '#db2777', surface: 'bg-pink-600', ink: 'text-white' },
] as const;

export default function DocumentTextColorMenu({ editor }: { editor: Editor }) {
  const t = useTranslations('documents.toolbar');
  const textColor =
    (editor.getAttributes('textStyle').color as string | undefined)?.toLowerCase() ?? null;
  const highlightColor =
    (editor.getAttributes('highlight').color as string | undefined)?.toLowerCase() ?? null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="relative size-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={t('textColor')}
        >
          <Palette className="size-4 stroke-[1.75]" />
          <span
            className="absolute inset-x-2 bottom-1 h-0.5 rounded-full bg-current"
            style={textColor ? { backgroundColor: textColor } : undefined}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 space-y-3 rounded-xl p-3 shadow-xl">
        <div>
          <p className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground">
            {t('textColor')}
          </p>
          <div className="grid grid-cols-8 gap-1" aria-label={t('textColor')}>
            {COLORS.map((color, index) => (
              <button
                key={color.value ?? 'default'}
                type="button"
                className={cn(
                  'grid size-6 place-items-center rounded-full border border-black/10 ring-offset-2 ring-offset-popover transition-transform outline-none hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring',
                  color.surface,
                  color.ink,
                )}
                aria-label={color.value ? t('colorNumber', { number: index }) : t('defaultColor')}
                aria-pressed={textColor === color.value}
                onClick={() => {
                  if (color.value) editor.chain().focus().setColor(color.value).run();
                  else editor.chain().focus().unsetColor().run();
                }}
              >
                {textColor === color.value && <Check className="size-3.5 stroke-[2.5]" />}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t pt-3">
          <p className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground">
            {t('backgroundColor')}
          </p>
          <div className="grid grid-cols-8 gap-1" aria-label={t('backgroundColor')}>
            {COLORS.map((color, index) => (
              <button
                key={color.value ?? 'default'}
                type="button"
                className="grid size-6 place-items-center rounded-md border border-border/70 bg-background p-0.5 ring-offset-2 ring-offset-popover transition-transform outline-none hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={color.value ? t('colorNumber', { number: index }) : t('noBackground')}
                aria-pressed={highlightColor === color.value}
                onClick={() => {
                  if (color.value)
                    editor.chain().focus().setHighlight({ color: color.value }).run();
                  else editor.chain().focus().unsetHighlight().run();
                }}
              >
                <span
                  className={cn(
                    'grid size-full place-items-center rounded-[3px] opacity-55',
                    color.surface,
                    color.ink,
                  )}
                >
                  {highlightColor === color.value && <Check className="size-3 stroke-[2.5]" />}
                </span>
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
