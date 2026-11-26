import { type DragEvent } from 'react';
import { Download, PenLine, Plus, Trash2 } from 'lucide-react';
import type { Attachment } from '@/lib/api/endpoints/attachments';
import { isImage, setEmbedDragData } from '@/components/common/editor/attachmentEmbed';
import { attachmentPreviewKind } from '@/components/common/attachments/attachmentPreviewKind';
import { formatSize } from '@/utils/fileSize';
import AttachmentThumb from '@/components/common/attachments/AttachmentThumb';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

// One attachment in the Attachments section: a small preview, the name and the size.
// The actions take the place of the size while the row is hovered or focused, and
// stay shown on a phone. Unless read-only, the whole row is the drag source, so it
// can be dropped into the description.
export default function IssueAttachmentRow({
  attachment,
  thumbnailUrl,
  onOpen,
  onInsert,
  onAnnotate,
  onDelete,
  readOnly,
}: {
  attachment: Attachment;
  // The preview URL, which carries a version after the file was replaced.
  thumbnailUrl: string;
  onOpen: () => void;
  onInsert: () => void;
  onAnnotate: () => void;
  onDelete: () => void;
  readOnly?: boolean;
}) {
  const t = useTranslations('issue.attachments');
  const tCommon = useTranslations('common');
  const viewable = attachmentPreviewKind(attachment) !== null;
  const dragProps = readOnly
    ? {}
    : {
        draggable: true,
        onDragStart: (e: DragEvent<HTMLElement>) => setEmbedDragData(e.dataTransfer, attachment),
        title: t('dragIntoDescription'),
      };
  const file = (
    <>
      <span className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted [&_svg]:size-4">
        <AttachmentThumb attachment={{ ...attachment, url: thumbnailUrl }} sizes="32px" />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm" dir="auto">
        {attachment.filename}
      </span>
    </>
  );
  const action = 'size-7 text-muted-foreground/70 hover:text-foreground';

  return (
    <div
      {...dragProps}
      className="group flex min-h-10 items-center gap-2.5 rounded-md px-2 py-1 hover:bg-accent/50"
    >
      {viewable ? (
        <button
          type="button"
          onClick={onOpen}
          title={t('openPreview')}
          aria-label={t('open', { name: attachment.filename })}
          className="flex min-w-0 flex-1 cursor-zoom-in items-center gap-2.5 text-start"
        >
          {file}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2.5">{file}</div>
      )}

      <span className="shrink-0 text-xs text-muted-foreground/70 tabular-nums group-focus-within:hidden group-hover:hidden max-sm:hidden">
        {formatSize(attachment.sizeBytes)}
      </span>

      <div className="hidden shrink-0 items-center gap-0.5 group-focus-within:flex group-hover:flex max-sm:flex">
        {!readOnly && (
          <Button
            variant="ghost"
            size="icon"
            className={action}
            title={t('insertIntoDescription')}
            aria-label={t('insert', { name: attachment.filename })}
            onClick={onInsert}
          >
            <Plus className="size-4" />
          </Button>
        )}
        {!readOnly && isImage(attachment) && (
          <Button
            variant="ghost"
            size="icon"
            className={action}
            title={t('annotate')}
            aria-label={t('annotateFile', { name: attachment.filename })}
            onClick={onAnnotate}
          >
            <PenLine className="size-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className={action} asChild title={t('download')}>
          <a
            href={`${attachment.url}?download=1`}
            download={attachment.filename}
            aria-label={t('downloadFile', { name: attachment.filename })}
            draggable={false}
          >
            <Download className="size-4" />
          </a>
        </Button>
        {!readOnly && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground/70 hover:text-destructive"
            title={tCommon('delete')}
            aria-label={t('deleteFile', { name: attachment.filename })}
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
