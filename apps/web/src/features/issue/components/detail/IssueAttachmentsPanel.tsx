import { useRef, useState, type DragEvent } from 'react';
import {
  Download,
  FileIcon,
  GripVertical,
  HelpCircle,
  Paperclip,
  Plus,
  Trash2,
} from 'lucide-react';
import { type Attachment } from '@/lib/api';
import {
  useAttachmentsQuery,
  useDeleteAttachment,
  useUploadAttachment,
} from '../../services/attachments.service';
import { attachmentHtml, isImage, isVideo } from '../../utils/attachmentEmbed';
import { useStorageSettingsQuery } from '@/services/storage.service';
import { attachmentAccept, attachmentError, attachmentLimitHint } from '@/utils/uploadLimits';
import { Button } from '@/components/ui/button';
import {
  Attachment as AttachmentCard,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from '@/components/ui/attachment';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// The card's leading thumbnail: images and videos preview themselves, every
// other type falls back to a generic file glyph.
function AttachmentThumb({ a }: { a: Attachment }) {
  if (isImage(a)) return <img src={a.url} alt={a.filename} draggable={false} />;
  if (isVideo(a))
    return <video src={a.url} className="size-full object-cover" muted draggable={false} />;
  return <FileIcon className="text-muted-foreground" />;
}

function onDragStart(e: DragEvent<HTMLElement>, a: Attachment) {
  e.dataTransfer.setData('text/html', attachmentHtml(a));
  e.dataTransfer.setData('text/plain', a.url);
  e.dataTransfer.effectAllowed = 'copy';
  // Drag the whole card as the ghost, not just the grabbed handle.
  const card = e.currentTarget.closest('[data-slot="attachment"]');
  if (card) e.dataTransfer.setDragImage(card, 0, 0);
}

// Attachments for one issue: upload, preview (image/video inline), download,
// delete, and insert into the description. onInsert hands the attachment back to
// the parent, which embeds it into the description via the live editor.
export default function IssueAttachmentsPanel({
  issueId,
  onInsert,
}: {
  issueId: number;
  onInsert: (attachment: Attachment) => void;
}) {
  const attachmentsQuery = useAttachmentsQuery(issueId);
  const items = attachmentsQuery.data ?? [];
  const uploadAttachment = useUploadAttachment();
  const deleteAttachment = useDeleteAttachment(issueId);
  const limits = useStorageSettingsQuery().data;
  const [error, setError] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  // dragenter/dragleave fire for every child; count them so the overlay only
  // clears when the pointer actually leaves the panel.
  const dragDepth = useRef(0);

  const uploading = uploadAttachment.isPending;

  async function onFilesPicked(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    try {
      for (const file of Array.from(files)) {
        // The api enforces the same limits; checking here avoids sending a file
        // that is going to be refused.
        const reason = attachmentError(file, limits);
        if (reason) {
          setError(reason);
          continue;
        }
        await uploadAttachment.mutateAsync({ issueId, file });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  // Only external files trigger the upload drop zone; dragging an attachment
  // card (which carries text/html, not Files) must not.
  const isFileDrag = (e: DragEvent) => e.dataTransfer.types.includes('Files');

  function onDragEnter(e: DragEvent) {
    if (!isFileDrag(e)) return;
    dragDepth.current += 1;
    setDropActive(true);
  }

  function onDragOver(e: DragEvent) {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  function onDragLeave(e: DragEvent) {
    if (!isFileDrag(e)) return;
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDropActive(false);
    }
  }

  function onDrop(e: DragEvent) {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDropActive(false);
    void onFilesPicked(e.dataTransfer.files);
  }

  return (
    <div
      className="relative mt-6 border-t pt-5"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <Paperclip className="size-3.5" />
          Attachments
          {limits && (
            <Tooltip>
              <TooltipTrigger
                aria-label="Upload limits"
                className="text-muted-foreground/60 hover:text-muted-foreground"
              >
                <HelpCircle className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs normal-case">
                {attachmentLimitHint(limits)}
              </TooltipContent>
            </Tooltip>
          )}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5"
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
        >
          <Plus className="size-4" />
          {uploading ? 'Uploading…' : 'Add'}
        </Button>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={attachmentAccept(limits)}
          className="hidden"
          onChange={(e) => void onFilesPicked(e.target.files)}
        />
      </div>

      {error && <p className="mb-2 text-xs text-destructive">{error}</p>}

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          No attachments. Drop files here or use Add to upload.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((a) => (
            <AttachmentCard key={a.id} className="w-full">
              <span
                draggable
                onDragStart={(e) => onDragStart(e, a)}
                title="Drag into the description"
                aria-label={`Drag ${a.filename} into the description`}
                className="flex shrink-0 cursor-grab touch-none items-center self-stretch text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing"
              >
                <GripVertical className="size-4" />
              </span>

              <AttachmentMedia variant={isImage(a) || isVideo(a) ? 'image' : 'icon'}>
                <AttachmentThumb a={a} />
              </AttachmentMedia>

              <AttachmentContent>
                <AttachmentTitle>{a.filename}</AttachmentTitle>
                <AttachmentDescription>{formatSize(a.sizeBytes)}</AttachmentDescription>
              </AttachmentContent>

              <AttachmentActions>
                <AttachmentAction
                  size="sm"
                  onClick={() => onInsert(a)}
                  title="Insert into description"
                >
                  Insert
                </AttachmentAction>
                <AttachmentAction asChild title="Download">
                  <a
                    href={`${a.url}?download=1`}
                    download={a.filename}
                    aria-label={`Download ${a.filename}`}
                    draggable={false}
                  >
                    <Download />
                  </a>
                </AttachmentAction>
                <AttachmentAction
                  className="hover:text-destructive"
                  onClick={() => deleteAttachment.mutate(a.id)}
                  aria-label={`Delete ${a.filename}`}
                  title="Delete"
                >
                  <Trash2 />
                </AttachmentAction>
              </AttachmentActions>
            </AttachmentCard>
          ))}
        </div>
      )}

      {dropActive && (
        <div className="pointer-events-none absolute inset-0 top-5 z-30 flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-primary bg-background/80 text-primary backdrop-blur-sm">
          <Download className="size-6" />
          <span className="text-sm font-medium">Drop files to upload</span>
        </div>
      )}
    </div>
  );
}
