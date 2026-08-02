import { type DragEvent } from 'react';
import { Download, PenLine, Plus, Trash2 } from 'lucide-react';
import { type Attachment } from '@/lib/api';
import { attachmentHtml, isImage, isVideo } from '../../utils/attachmentEmbed';
import { formatSize } from '../../utils/fileSize';
import IssueAttachmentThumb from '../IssueAttachmentThumb';
import { Button } from '@/components/ui/button';

function onDragStart(e: DragEvent<HTMLElement>, a: Attachment) {
  e.dataTransfer.setData('text/html', attachmentHtml(a));
  e.dataTransfer.setData('text/plain', a.url);
  e.dataTransfer.effectAllowed = 'copy';
}

// One attachment in the panel grid: a preview to recognise the file by, its name
// and size, and the actions on top of the preview. The whole card is the drag
// source, so it can be dropped into the description.
export default function IssueAttachmentCard({
  attachment,
  thumbnailUrl,
  onOpen,
  onInsert,
  onAnnotate,
  onDelete,
}: {
  attachment: Attachment;
  // The preview URL, which carries a version after the file was replaced.
  thumbnailUrl: string;
  onOpen: () => void;
  onInsert: () => void;
  onAnnotate: () => void;
  onDelete: () => void;
}) {
  const viewable = isImage(attachment) || isVideo(attachment);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, attachment)}
      title="Drag into the description"
      className="group relative flex cursor-grab flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:border-ring/40 active:cursor-grabbing"
    >
      <div className="relative flex aspect-video items-center justify-center bg-muted [&_svg]:size-7">
        <IssueAttachmentThumb
          attachment={{ ...attachment, url: thumbnailUrl }}
          sizes="(min-width: 640px) 12rem, 50vw"
        />

        {viewable && (
          <button
            type="button"
            onClick={onOpen}
            title="Open preview"
            aria-label={`Open ${attachment.filename}`}
            className="absolute inset-0 cursor-zoom-in"
          />
        )}

        {/* Only the controls take clicks, so the rest of the preview opens it.
            They sit on one opaque bar because the preview under them is a
            screenshot as often as not, and icons alone drown in it. */}
        <div className="pointer-events-none absolute inset-0 bg-black/30 p-1.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
          <div className="pointer-events-auto mx-auto flex w-fit items-center gap-0.5 rounded-md border bg-popover p-0.5 shadow-lg shadow-black/30">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              title="Insert into the description"
              aria-label={`Insert ${attachment.filename} into the description`}
              onClick={onInsert}
            >
              <Plus />
            </Button>
            {isImage(attachment) && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                title="Annotate"
                aria-label={`Annotate ${attachment.filename}`}
                onClick={onAnnotate}
              >
                <PenLine />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="size-7" asChild title="Download">
              <a
                href={`${attachment.url}?download=1`}
                download={attachment.filename}
                aria-label={`Download ${attachment.filename}`}
                draggable={false}
              >
                <Download />
              </a>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-destructive"
              title="Delete"
              aria-label={`Delete ${attachment.filename}`}
              onClick={onDelete}
            >
              <Trash2 />
            </Button>
          </div>
        </div>
      </div>

      <div className="min-w-0 px-2 py-1.5">
        <p className="truncate text-xs" title={attachment.filename}>
          {attachment.filename}
        </p>
        <p className="text-[11px] text-muted-foreground">{formatSize(attachment.sizeBytes)}</p>
      </div>
    </div>
  );
}
