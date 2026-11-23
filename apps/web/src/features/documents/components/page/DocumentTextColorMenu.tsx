'use client';

import type { Editor } from '@tiptap/react';
import { Ban, Palette } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import DocumentToolbarButton from './DocumentToolbarButton';

const COLORS = [null, '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#2563eb', '#7c3aed', '#db2777'];
// A background is the text colour at 20% opacity, so the text on it stays readable in
// both themes.
const tint = (color: string) => `${color}33`;

const SWATCH =
  'grid size-7 place-items-center rounded-md text-sm font-semibold shadow-[inset_0_0_0_1px_var(--border)] transition-shadow outline-none hover:shadow-[inset_0_0_0_1.5px_var(--ring)] focus-visible:ring-2 focus-visible:ring-ring aria-pressed:shadow-[inset_0_0_0_2px_var(--foreground)]';

export default function DocumentTextColorMenu({ editor }: { editor: Editor }) {
  const t = useTranslations('documents.toolbar');
  const textColor =
    (editor.getAttributes('textStyle').color as string | undefined)?.toLowerCase() ?? null;
  const highlightColor =
    (editor.getAttributes('highlight').color as string | undefined)?.toLowerCase() ?? null;
  const label = (color: string | null, index: number, none: string) =>
    color ? t('colorNumber', { number: index }) : none;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <DocumentToolbarButton label={t('textColor')}>
          <Palette />
          <span
            className="absolute start-2.25 bottom-1.5 h-0.5 w-3.5 rounded-[1px] bg-foreground"
            style={textColor ? { backgroundColor: textColor } : undefined}
          />
        </DocumentToolbarButton>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto p-1"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <p className="px-2 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">
          {t('textColor')}
        </p>
        <div className="grid grid-cols-8 gap-1 px-2 pt-0.5 pb-2" dir="ltr">
          {COLORS.map((color, index) => (
            <button
              key={color ?? 'default'}
              type="button"
              className={SWATCH}
              style={{ color: color ?? 'var(--foreground)' }}
              aria-label={label(color, index, t('defaultColor'))}
              aria-pressed={textColor === color}
              onClick={() => {
                if (color) editor.chain().focus().setColor(color).run();
                else editor.chain().focus().unsetColor().run();
              }}
            >
              A
            </button>
          ))}
        </div>
        <p className="px-2 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">
          {t('backgroundColor')}
        </p>
        <div className="grid grid-cols-8 gap-1 px-2 pt-0.5 pb-2" dir="ltr">
          {COLORS.map((color, index) => (
            <button
              key={color ?? 'default'}
              type="button"
              className={`${SWATCH} text-muted-foreground`}
              style={color ? { backgroundColor: tint(color) } : undefined}
              aria-label={label(color, index, t('noBackground'))}
              aria-pressed={highlightColor === (color && tint(color))}
              onClick={() => {
                if (color)
                  editor
                    .chain()
                    .focus()
                    .setHighlight({ color: tint(color) })
                    .run();
                else editor.chain().focus().unsetHighlight().run();
              }}
            >
              {!color && <Ban className="size-3.5" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
