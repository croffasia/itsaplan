import { useState } from 'react';
import { X } from 'lucide-react';
import { type PendingAttachment } from '../../hooks/useNewIssueAttachments';
import { isImage, type Embeddable } from '../../utils/attachmentEmbed';
import { formatSize } from '../../utils/fileSize';
import { baseName } from '../../utils/filename';
import IssueAttachmentThumb from '../IssueAttachmentThumb';
import IssueImageAnnotator from '../IssueImageAnnotator';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTranslations } from 'next-intl';

// One pending file in the footer strip: the thumbnail opens a larger preview to
// insert the file from, the corner button drops it. That button overhangs the
// thumbnail by half its size, which the strip pads for.
export default function NewIssueAttachmentChip({
  item,
  onInsert,
  onAnnotate,
  onRemove,
}: {
  item: PendingAttachment;
  // Left out while no editor is open to insert into: the preview then only shows.
  onInsert?: (attachment: Embeddable) => void;
  onAnnotate: (id: number, file: File) => void;
  onRemove: (id: number) => void;
}) {
  const t = useTranslations('issue.attachments');
  const [open, setOpen] = useState(false);
  const [annotating, setAnnotating] = useState(false);

  return (
    <div className="group relative size-10 shrink-0">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={t('preview', { name: item.filename })}
            className="relative flex size-full items-center justify-center overflow-hidden rounded-md border bg-muted hover:border-ring"
          >
            <IssueAttachmentThumb attachment={item} />
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" align="start" className="w-64 space-y-2 p-2">
          <div className="relative flex h-40 items-center justify-center overflow-hidden rounded-md border bg-muted">
            <IssueAttachmentThumb attachment={item} sizes="240px" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{item.filename}</p>
            <p className="text-xs text-muted-foreground">{formatSize(item.file.size)}</p>
          </div>
          {onInsert && (
            <Button
              size="sm"
              className="w-full"
              onClick={() => {
                onInsert(item);
                setOpen(false);
              }}
            >
              {t('insertShort')}
            </Button>
          )}
          {isImage(item) && (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => {
                setOpen(false);
                setAnnotating(true);
              }}
            >
              {t('annotate')}
            </Button>
          )}
        </PopoverContent>
      </Popover>

      {annotating && (
        <IssueImageAnnotator
          src={item.url}
          savedName={baseName(item.filename)}
          // Nothing is uploaded yet, so the marked-up image takes the place of the
          // file it was drawn on instead of being added next to it.
          onSave={(file) => {
            setAnnotating(false);
            onAnnotate(item.id, file);
          }}
          onClose={() => setAnnotating(false)}
        />
      )}
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        aria-label={t('remove', { name: item.filename })}
        title={t('removeShort')}
        className="absolute -top-2 -right-2 flex size-4 items-center justify-center rounded-full border bg-popover text-muted-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
