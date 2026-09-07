'use client';

import { useRef, useState } from 'react';
import { Download, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type Attachment } from '@/lib/api';
import { isImage, isVideo } from '@/components/common/editor/attachmentEmbed';
import AttachmentThumb from '@/components/common/attachments/AttachmentThumb';
import AttachmentViewer from '@/components/common/attachments/AttachmentViewer';
import { Button } from '@/components/ui/button';
import { useFileDragZone } from '@/hooks/useFileDragZone';
import { usePermissions } from '@/hooks/usePermissions';
import { useStorageSettingsQuery } from '@/services/storage.service';
import { formatSize } from '@/utils/fileSize';
import { attachmentAccept, attachmentError, attachmentLimitHint } from '@/utils/uploadLimits';
import {
  useDeleteInitiativeAttachment,
  useInitiativeAttachmentsQuery,
  useUploadInitiativeAttachment,
} from '../../services/attachments.service';

// The initiative's files, beside its description: upload, look at, download and
// delete. A row list rather than the issue panel's card grid, because it sits in
// the narrow column next to the description.
export default function InitiativeAttachments({ initiativeId }: { initiativeId: number }) {
  const t = useTranslations('initiatives.attachments');
  const tCommon = useTranslations('common');
  const { can } = usePermissions();
  const canEdit = can('initiatives', 'edit');
  const items = useInitiativeAttachmentsQuery(initiativeId).data ?? [];
  const upload = useUploadInitiativeAttachment(initiativeId);
  const remove = useDeleteInitiativeAttachment(initiativeId);
  const limits = useStorageSettingsQuery().data;
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Attachment | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function send(files: FileList | null) {
    if (!files || files.length === 0 || !canEdit) return;
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
        await upload.mutateAsync(file);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('uploadFailed'));
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  const { draggedFiles, dragHandlers } = useFileDragZone((files) => void send(files));

  return (
    <div className="relative" {...(canEdit ? dragHandlers : {})}>
      <div className="flex h-7 items-center justify-between gap-3">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {t('title')}
        </h2>
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5"
            disabled={upload.isPending}
            title={attachmentLimitHint(limits)}
            onClick={() => fileInput.current?.click()}
          >
            <Plus className="size-4" />
            {upload.isPending ? t('uploading') : t('add')}
          </Button>
        )}
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={attachmentAccept(limits)}
          className="hidden"
          onChange={(e) => void send(e.target.files)}
        />
      </div>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      {items.length === 0 ? (
        <p className="mt-3 rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          {canEdit ? t('emptyHint') : t('empty')}
        </p>
      ) : (
        <ul className="mt-3 space-y-1">
          {items.map((a) => {
            const viewable = isImage(a) || isVideo(a);
            return (
              <li
                key={a.id}
                className="group flex items-center gap-2 rounded-md border bg-card p-1.5 transition-colors hover:border-ring/40"
              >
                <button
                  type="button"
                  disabled={!viewable}
                  onClick={() => setViewing(a)}
                  aria-label={t('open', { name: a.filename })}
                  className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded bg-muted enabled:cursor-zoom-in [&_svg]:size-5"
                >
                  <AttachmentThumb attachment={a} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs" title={a.filename}>
                    {a.filename}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{formatSize(a.sizeBytes)}</p>
                </div>
                <Button variant="ghost" size="icon" className="size-7" asChild>
                  <a
                    href={`${a.url}?download=1`}
                    download={a.filename}
                    title={t('download')}
                    aria-label={t('downloadFile', { name: a.filename })}
                  >
                    <Download />
                  </a>
                </Button>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    title={tCommon('delete')}
                    aria-label={t('deleteFile', { name: a.filename })}
                    onClick={() => remove.mutate(a.id)}
                  >
                    <Trash2 />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {viewing && <AttachmentViewer attachment={viewing} onClose={() => setViewing(null)} />}

      {draggedFiles !== null && (
        <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-primary bg-background/80 text-primary backdrop-blur-sm">
          <Download className="size-6" />
          <span className="text-sm font-medium">{t('dropToUpload')}</span>
        </div>
      )}
    </div>
  );
}
