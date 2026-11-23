'use client';

import { useRef, useState } from 'react';
import {
  FileDown,
  FilePlus2,
  Heading2,
  ListChecks,
  LockKeyhole,
  SquareCode,
  Table,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// A picture of the slash menu, so a new user sees what typing / gives.
const SLASH = [
  [Heading2, 'toolbar.heading2'],
  [ListChecks, 'toolbar.todoList'],
  [Table, 'toolbar.table'],
  [SquareCode, 'toolbar.codeBlock'],
] as const;

const tile =
  'relative flex flex-col items-start gap-1 rounded-xl p-5 text-start transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50';
const tileIcon = 'mb-2 grid size-9 place-items-center rounded-lg bg-muted [&_svg]:size-4';
const tileTitle = 'text-[15px] font-semibold tracking-[-0.01em]';
const tileText = 'max-w-[46ch] text-[13px] text-muted-foreground';

export default function DocumentsHomeEmptyTiles({
  busy,
  onCreate,
  onCreatePrivate,
  onUpload,
}: {
  busy: boolean;
  onCreate: () => void;
  onCreatePrivate: () => void;
  onUpload: (file: File) => void;
}) {
  const t = useTranslations('documents');
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const upload = (file: File | undefined) => {
    if (!file) return;
    if (/\.(md|markdown)$/i.test(file.name) || file.type === 'text/markdown') onUpload(file);
    else toast.error(t('home.markdownOnly'));
  };

  return (
    <div className="grid max-w-[1080px] grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-3 max-[720px]:grid-cols-1">
      <button
        type="button"
        disabled={busy}
        onClick={onCreate}
        className={cn(
          tile,
          "row-span-2 gap-1.5 bg-card p-6 shadow-[var(--tile-shadow)] after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:opacity-0 after:shadow-[var(--tile-shadow-hover)] after:transition-opacity after:content-[''] hover:after:opacity-100 max-[720px]:row-span-1",
        )}
      >
        <span className={cn(tileIcon, 'bg-primary text-primary-foreground')}>
          <FilePlus2 />
        </span>
        <span className="text-lg font-semibold tracking-[-0.01em]">{t('newDocument')}</span>
        <span className={tileText}>{t('home.newPageHint')}</span>
        <span
          aria-hidden
          className="mt-4 block w-full max-w-70 rounded-lg bg-popover p-1 shadow-[var(--overlay-shadow),0_0_0_1px_var(--border)]"
        >
          <span className="block px-2 py-1.5 font-mono text-[13px] text-muted-foreground">/</span>
          {SLASH.map(([Icon, key], index) => (
            <span
              key={key}
              className={cn(
                'flex h-7.5 items-center gap-2.5 rounded-md px-2 text-[13px]',
                index === 0 && 'bg-accent',
              )}
            >
              <Icon className="size-3.5 text-muted-foreground" />
              {t(key)}
            </span>
          ))}
        </span>
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onCreatePrivate}
        className={cn(tile, 'bg-muted/55 hover:bg-accent')}
      >
        <span className={tileIcon}>
          <LockKeyhole />
        </span>
        <span className={tileTitle}>{t('privatePage')}</span>
        <span className={tileText}>{t('home.privatePageHint')}</span>
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          upload(event.dataTransfer.files[0]);
        }}
        className={cn(
          tile,
          'outline-[1.5px] outline-offset-[-1.5px] outline-input outline-dashed hover:bg-accent',
          dragging && 'bg-accent',
        )}
      >
        <span className={tileIcon}>
          <FileDown />
        </span>
        <span className={tileTitle}>{t('uploadMarkdown')}</span>
        <span className={tileText}>{t('home.uploadHint')}</span>
      </button>
      <input
        ref={input}
        className="sr-only"
        type="file"
        accept=".md,.markdown,text/markdown"
        aria-label={t('uploadMarkdown')}
        tabIndex={-1}
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = '';
          upload(file);
        }}
      />
    </div>
  );
}
