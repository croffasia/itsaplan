'use client';

import { Content as DialogContent } from '@radix-ui/react-dialog';
import { ArrowLeft, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog';
import LinkPreviewContent from './LinkPreviewContent';
import LinkPreviewList from './LinkPreviewList';
import { useLinkPreviewDialog } from './useLinkPreviewDialog';
import styles from './LinkPreviewDialog.module.css';

export type LinkPreviewItem = { url: string; label: string; onEdit?: () => void };

export default function LinkPreviewDialog({
  links,
  onClose,
  trigger,
  container,
}: {
  links: LinkPreviewItem[];
  onClose: () => void;
  trigger: HTMLElement | null;
  container: HTMLElement | null;
}) {
  const t = useTranslations('common');
  const dialog = useLinkPreviewDialog({ linkCount: links.length, onClose, trigger, container });
  const link = dialog.selected === null ? undefined : links[dialog.selected];

  return (
    <Dialog open={dialog.open} onOpenChange={dialog.setOpen}>
      <DialogPortal>
        <DialogOverlay className={styles.overlay} />
        <DialogContent
          data-slot="dialog-content"
          className={`${styles.dialog} flex flex-col gap-4 overflow-hidden bg-card text-card-foreground outline-none`}
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            dialog.focusAction();
          }}
          onCloseAutoFocus={dialog.closeAutoFocus}
          onEscapeKeyDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex shrink-0 items-center gap-4">
            <DialogTitle className="min-w-0 flex-1 text-start text-base leading-normal">
              {t('editor.linkPreview')}
            </DialogTitle>
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={styles.control}
                aria-label={t('close')}
              >
                <X aria-hidden="true" />
              </Button>
            </DialogClose>
          </div>
          <div
            ref={dialog.body}
            className="flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain"
          >
            {link && links.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                className={`${styles.control} self-start`}
                onClick={dialog.backToLinks}
              >
                <ArrowLeft className="rtl:rotate-180" aria-hidden="true" />
                {t('editor.backToLinks')}
              </Button>
            )}
            {link ? (
              <LinkPreviewContent
                key={link.url}
                link={link}
                onEdit={link.onEdit ? () => dialog.editLink(link.onEdit!) : undefined}
              />
            ) : (
              <LinkPreviewList
                links={links}
                focusIndex={dialog.focusIndex}
                onSelect={dialog.select}
              />
            )}
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
