'use client';

import { useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { DocumentAsset } from '@/lib/api/endpoints/documents';
import { Button } from '@/components/ui/button';
import { useFileDragZone } from '@/hooks/useFileDragZone';
import { cn } from '@/lib/utils';
import { useDocumentAssetsQuery, useUploadDocumentAsset } from '../../services/documents.service';
import DocumentAssetActions from './DocumentAssetActions';
import DocumentAssetDeleteDialog from './DocumentAssetDeleteDialog';
import DocumentAssetList from './DocumentAssetList';
import DocumentDetailsSection from './DocumentDetailsSection';

// The files uploaded to the page, with upload by button or drop, insert and delete.
export default function DocumentDetailsAssets({
  projectKey,
  documentId,
  editor,
  canUpload,
  canDelete,
}: {
  projectKey: string;
  documentId: number;
  editor: Editor | null;
  canUpload: boolean;
  canDelete: boolean;
}) {
  const t = useTranslations('documents');
  const fileInput = useRef<HTMLInputElement>(null);
  const [deleting, setDeleting] = useState<DocumentAsset | null>(null);
  const assets = useDocumentAssetsQuery(projectKey, documentId);
  const upload = useUploadDocumentAsset(projectKey, documentId);
  const items = assets.data ?? [];
  const canInsert = canUpload && Boolean(editor?.isEditable);

  const uploadAll = async (list: FileList | null) => {
    for (const file of Array.from(list ?? [])) {
      // A failed upload is toasted by the shared mutation handler; the rest still go.
      await upload.mutateAsync(file).catch(() => undefined);
    }
  };
  const { draggedFiles, dragHandlers } = useFileDragZone((list) => void uploadAll(list));

  const insert = (asset: DocumentAsset) => {
    if (!editor || editor.isDestroyed || !editor.isEditable) return;
    if (asset.contentType.startsWith('image/')) {
      editor.chain().focus().setImage({ src: asset.url, alt: asset.filename }).run();
      return;
    }
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'text',
        text: asset.filename,
        marks: [{ type: 'link', attrs: { href: asset.url } }],
      })
      .run();
  };

  return (
    <DocumentDetailsSection
      id="assets"
      title={t('assets')}
      count={items.length}
      className={cn(
        draggedFiles !== null &&
          'rounded-md outline-2 outline-offset-4 outline-ring outline-dashed',
      )}
      {...(canUpload ? dragHandlers : {})}
      action={
        canUpload && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-muted-foreground"
            title={t('inspector.dropHint')}
            disabled={upload.isPending}
            onClick={() => fileInput.current?.click()}
          >
            {upload.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
            {t('inspector.add')}
          </Button>
        )
      }
    >
      <input
        ref={fileInput}
        type="file"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-label={t('uploadAsset')}
        onChange={(event) => {
          const list = event.target.files;
          void uploadAll(list).finally(() => {
            if (fileInput.current) fileInput.current.value = '';
          });
        }}
      />
      <DocumentAssetList
        assets={items}
        loading={assets.isLoading}
        failed={assets.isError}
        emptyText={canUpload ? t('inspector.assetsEmptyEditable') : t('noAssets')}
        actions={(asset) => (
          <DocumentAssetActions
            asset={asset}
            onInsert={canInsert ? () => insert(asset) : undefined}
            onDelete={canDelete ? () => setDeleting(asset) : undefined}
          />
        )}
        onRetry={() => void assets.refetch()}
      />

      {deleting && (
        <DocumentAssetDeleteDialog
          projectKey={projectKey}
          documentId={documentId}
          asset={deleting}
          onClose={() => setDeleting(null)}
        />
      )}
    </DocumentDetailsSection>
  );
}
