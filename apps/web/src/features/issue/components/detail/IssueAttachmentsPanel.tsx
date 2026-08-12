import { useRef, useState } from 'react';
import { Download, Plus } from 'lucide-react';
import { type Attachment } from '@/lib/api';
import { useFileDragZone } from '../../hooks/useFileDragZone';
import { usePersistedOpen } from '../../hooks/usePersistedOpen';
import {
  useAttachmentsQuery,
  useDeleteAttachment,
  useReplaceAttachment,
  useUploadAttachment,
} from '../../services/attachments.service';
import { baseName } from '../../utils/filename';
import IssueImageAnnotator from '../IssueImageAnnotator';
import IssueAttachmentCard from './IssueAttachmentCard';
import IssueAttachmentViewer from './IssueAttachmentViewer';
import IssueSectionHeading from './IssueSectionHeading';
import { useStorageSettingsQuery } from '@/services/storage.service';
import { attachmentAccept, attachmentError, attachmentLimitHint } from '@/utils/uploadLimits';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

// Attachments for one issue, as a grid of preview cards: upload, look at,
// annotate, download, delete, and insert into the description. onInsert hands the
// attachment back to the parent, which embeds it via the live editor.
export default function IssueAttachmentsPanel({
  issueId,
  onInsert,
  onReplaced,
  readOnly,
}: {
  issueId: number;
  onInsert: (attachment: Attachment) => void;
  onReplaced: () => void;
  // When true the files can only be viewed and downloaded.
  readOnly?: boolean;
}) {
  const t = useTranslations('issue.attachments');
  const attachmentsQuery = useAttachmentsQuery(issueId);
  const items = attachmentsQuery.data ?? [];
  const uploadAttachment = useUploadAttachment();
  const replaceAttachment = useReplaceAttachment(issueId);
  const deleteAttachment = useDeleteAttachment(issueId);
  const limits = useStorageSettingsQuery().data;
  const [error, setError] = useState<string | null>(null);
  const [annotating, setAnnotating] = useState<Attachment | null>(null);
  const [viewing, setViewing] = useState<Attachment | null>(null);
  // A replaced attachment keeps its URL, which the image optimizer caches its
  // thumbnail under. Stamping the ones replaced here tells the two versions apart.
  const [replacedAt, setReplacedAt] = useState<Record<string, number>>({});
  const { open, toggle } = usePersistedOpen('issue-attachments-open');
  const fileInput = useRef<HTMLInputElement>(null);

  const uploading = uploadAttachment.isPending;

  function thumbnailUrl(a: Attachment): string {
    const stamp = replacedAt[a.id];
    return stamp ? `${a.url}?v=${stamp}` : a.url;
  }

  async function upload(files: FileList | null) {
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
      setError(err instanceof Error ? err.message : t('uploadFailed'));
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  const { draggedFiles, dragHandlers } = useFileDragZone((files) => void upload(files));

  return (
    // Collapsed, the heading row is all there is, so the section pulls itself up
    // the way the Links one below it does.
    <div
      className={`relative mt-6 border-t pt-5 ${open ? '' : '-mb-2'}`}
      {...(readOnly ? {} : dragHandlers)}
    >
      {/* Fixed height: the Add button only renders while the section is open, and
          without it the row would shrink to the height of the heading text. */}
      <div className={`flex h-7 items-center justify-between gap-3 ${open ? 'mb-3' : ''}`}>
        <IssueSectionHeading label={t('title')} open={open} onToggle={toggle} />
        {open && !readOnly && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5"
            disabled={uploading}
            title={attachmentLimitHint(limits)}
            onClick={() => fileInput.current?.click()}
          >
            <Plus className="size-4" />
            {uploading ? t('uploading') : t('add')}
          </Button>
        )}
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={attachmentAccept(limits)}
          className="hidden"
          onChange={(e) => void upload(e.target.files)}
        />
      </div>

      {error && <p className="mb-2 text-xs text-destructive">{error}</p>}

      {open &&
        (items.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            {readOnly ? t('empty') : t('emptyHint')}
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2">
            {items.map((a) => (
              <IssueAttachmentCard
                key={a.id}
                attachment={a}
                thumbnailUrl={thumbnailUrl(a)}
                onOpen={() => setViewing(a)}
                onInsert={() => onInsert(a)}
                onAnnotate={() => setAnnotating(a)}
                onDelete={() => deleteAttachment.mutate(a.id)}
                readOnly={readOnly}
              />
            ))}
          </div>
        ))}

      {viewing && <IssueAttachmentViewer attachment={viewing} onClose={() => setViewing(null)} />}

      {annotating && (
        <IssueImageAnnotator
          src={annotating.url}
          savedName={baseName(annotating.filename)}
          // The marks become the attachment itself, so wherever it is already
          // embedded now shows them; its id and URL do not change.
          onSave={(file) => {
            const publicId = annotating.id;
            setError(null);
            replaceAttachment.mutate(
              { publicId, file },
              {
                onSuccess: () => {
                  setReplacedAt((prev) => ({ ...prev, [publicId]: Date.now() }));
                  onReplaced();
                },
                onError: (err) => setError(err.message),
              },
            );
            setAnnotating(null);
          }}
          onClose={() => setAnnotating(null)}
        />
      )}

      {draggedFiles !== null && (
        <div className="pointer-events-none absolute inset-0 top-5 z-30 flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-primary bg-background/80 text-primary backdrop-blur-sm">
          <Download className="size-6" />
          <span className="text-sm font-medium">{t('dropToUpload')}</span>
        </div>
      )}
    </div>
  );
}
