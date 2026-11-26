import { type RefObject, useState } from 'react';
import { Download } from 'lucide-react';
import type { Attachment } from '@/lib/api/endpoints/attachments';
import { useFileDragZone } from '@/hooks/useFileDragZone';
import { usePersistedOpen } from '@/hooks/usePersistedOpen';
import {
  useAttachmentsQuery,
  useDeleteAttachment,
  useReplaceAttachment,
  useUploadAttachment,
} from '../../services/attachments.service';
import { baseName } from '../../utils/filename';
import IssueImageAnnotator from '../IssueImageAnnotator';
import IssueAttachmentRow from './IssueAttachmentRow';
import AttachmentViewer from '@/components/common/attachments/AttachmentViewer';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import IssueSection from './IssueSection';
import IssueSectionAddButton from './IssueSectionAddButton';
import IssueSectionHeading from './IssueSectionHeading';
import { useStorageSettingsQuery } from '@/services/storage.service';
import { attachmentAccept, attachmentError, attachmentLimitHint } from '@/utils/uploadLimits';
import { useTranslations } from 'next-intl';

// Attachments for one issue, as a list of rows: upload, look at,
// annotate, download, delete, and insert into the description. onInsert hands the
// attachment back to the parent, which embeds it via the live editor. With no files
// the section stays off the page, and only its file picker is rendered, for the
// issue's add bar to open.
export default function IssueAttachmentsPanel({
  issueId,
  fileInput,
  onInsert,
  onReplaced,
  readOnly,
}: {
  issueId: number;
  // The section's file picker, which the issue's add bar opens as well.
  fileInput: RefObject<HTMLInputElement | null>;
  onInsert: (attachment: Attachment) => void;
  onReplaced: () => void;
  // When true the files can only be viewed and downloaded.
  readOnly?: boolean;
}) {
  const t = useTranslations('issue.attachments');
  const tCommon = useTranslations('common');
  const attachmentsQuery = useAttachmentsQuery(issueId);
  const items = attachmentsQuery.data ?? [];
  const uploadAttachment = useUploadAttachment();
  const replaceAttachment = useReplaceAttachment(issueId);
  const deleteAttachment = useDeleteAttachment(issueId);
  const limits = useStorageSettingsQuery().data;
  const [error, setError] = useState<string | null>(null);
  const [annotating, setAnnotating] = useState<Attachment | null>(null);
  const [viewing, setViewing] = useState<Attachment | null>(null);
  const [deleting, setDeleting] = useState<Attachment | null>(null);
  // A replaced attachment keeps its URL, which the image optimizer caches its
  // thumbnail under. Stamping the ones replaced here tells the two versions apart.
  const [replacedAt, setReplacedAt] = useState<Record<string, number>>({});
  const { open, toggle } = usePersistedOpen('issue-attachments-open');

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

  const picker = (
    <input
      ref={fileInput}
      type="file"
      multiple
      accept={attachmentAccept(limits)}
      className="hidden"
      onChange={(e) => void upload(e.target.files)}
    />
  );
  // An upload in flight or one that failed shows the section, so its progress and its
  // error have somewhere to appear before the first file lands.
  if (items.length === 0 && !uploading && !error) return picker;

  return (
    <IssueSection collapsed={!open} className="relative" {...(readOnly ? {} : dragHandlers)}>
      <IssueSectionHeading
        label={t('title')}
        open={open}
        onToggle={toggle}
        actions={
          <>
            {open && !readOnly && (
              <IssueSectionAddButton
                label={uploading ? t('uploading') : t('add')}
                busy={uploading}
                disabled={uploading}
                title={attachmentLimitHint(limits)}
                onClick={() => fileInput.current?.click()}
              />
            )}
            {picker}
          </>
        }
      />

      {error && <p className="mb-2 text-xs text-destructive">{error}</p>}

      {open && items.length > 0 && (
        <div className="-mx-2 flex flex-col">
          {items.map((a) => (
            <IssueAttachmentRow
              key={a.id}
              attachment={a}
              thumbnailUrl={thumbnailUrl(a)}
              onOpen={() => setViewing(a)}
              onInsert={() => onInsert(a)}
              onAnnotate={() => setAnnotating(a)}
              onDelete={() => setDeleting(a)}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}

      {viewing && <AttachmentViewer attachment={viewing} onClose={() => setViewing(null)} />}

      {deleting && (
        <ConfirmDialog
          title={t('deleteTitle')}
          confirmLabel={tCommon('delete')}
          onConfirm={async () => {
            await deleteAttachment.mutateAsync(deleting.id);
            setDeleting(null);
          }}
          onClose={() => setDeleting(null)}
        >
          <p className="text-sm text-muted-foreground">
            {t('deleteConfirmation', { name: deleting.filename })}
          </p>
        </ConfirmDialog>
      )}

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
    </IssueSection>
  );
}
