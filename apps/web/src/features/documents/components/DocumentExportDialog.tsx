'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Download, FileCode2, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import {
  createPortableDocumentExport,
  DocumentExportLimitError,
  type DocumentExportFormat,
} from '../utils/documentExport';

const formats = [
  { key: 'markdown', icon: FileText },
  { key: 'html', icon: FileCode2 },
] as const;

export default function DocumentExportDialog({
  open,
  projectKey,
  documentId,
  title,
  content,
  richHtml,
  onOpenChange,
}: {
  open: boolean;
  projectKey: string;
  documentId: number;
  title: string;
  content: string;
  richHtml: string;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('documents');
  const [format, setFormat] = useState<DocumentExportFormat>('markdown');
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<'generic' | 'limit' | null>(null);
  const downloadLock = useRef(false);

  useEffect(() => {
    if (open) setFailure(null);
  }, [open]);

  const changeOpen = (nextOpen: boolean) => {
    if (downloadLock.current) return;
    onOpenChange(nextOpen);
  };

  const download = async () => {
    if (downloadLock.current) return;
    downloadLock.current = true;
    setPending(true);
    setFailure(null);

    try {
      const result = await createPortableDocumentExport({
        title,
        content,
        richHtml,
        format,
        projectKey,
        documentId,
        baseUrl: window.location.origin,
      });
      const url = URL.createObjectURL(result.blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = result.filename;
      anchor.hidden = true;
      try {
        window.document.body.append(anchor);
        anchor.click();
      } finally {
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      onOpenChange(false);
    } catch (error) {
      setFailure(error instanceof DocumentExportLimitError ? 'limit' : 'generic');
    } finally {
      downloadLock.current = false;
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent
        className="sm:max-w-lg"
        showCloseButton={!pending}
        aria-busy={pending}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <DialogHeader className="text-start">
          <DialogTitle>{t('exportTitle')}</DialogTitle>
          <DialogDescription>{t('exportDescription')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-2" role="radiogroup" aria-label={t('exportFormat')}>
          {formats.map(({ key, icon: Icon }) => {
            const selected = format === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={pending}
                className={cn(
                  'group flex min-h-16 items-center gap-3 rounded-lg border px-3 text-start transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
                  selected ? 'border-foreground/25 bg-muted/50' : 'hover:bg-muted/30',
                )}
                onClick={() => {
                  setFormat(key);
                  setFailure(null);
                }}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-background shadow-xs ring-1 ring-border">
                  <Icon className="size-4 text-muted-foreground" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{t(key)}</span>
                  {key === 'markdown' && (
                    <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">
                      {t('markdownExportHint')}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    'grid size-5 shrink-0 place-items-center rounded-full border',
                    selected && 'border-primary bg-primary text-primary-foreground',
                  )}
                  aria-hidden
                >
                  {selected && <Check className="size-3" />}
                </span>
              </button>
            );
          })}
        </div>

        {failure && (
          <p
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {t(failure === 'limit' ? 'exportTooLarge' : 'exportFailed')}
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => changeOpen(false)}
          >
            {t('cancel')}
          </Button>
          <Button type="button" disabled={pending} onClick={() => void download()}>
            {pending ? <Loader2 className="animate-spin" /> : <Download />}
            {pending ? t('exporting') : t('download')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
