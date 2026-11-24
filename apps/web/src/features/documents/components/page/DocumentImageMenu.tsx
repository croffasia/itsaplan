'use client';

import { useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { ImagePlus, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDocumentAssetsQuery, useUploadDocumentAsset } from '../../services/documents.service';
import {
  firstImageFile,
  insertDocumentImage,
  uploadAndInsertImage,
} from '../DocumentMarkdownEditor';
import DocumentImageLibrary from './DocumentImageLibrary';
import DocumentToolbarButton from './DocumentToolbarButton';

export default function DocumentImageMenu({
  editor,
  projectKey,
  documentId,
  canUpload,
}: {
  editor: Editor;
  projectKey: string;
  documentId: number;
  canUpload: boolean;
}) {
  const t = useTranslations('documents.toolbar');
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const editableRef = useRef(canUpload);
  editableRef.current = canUpload;
  const assets = useDocumentAssetsQuery(open ? projectKey : null, open ? documentId : null);
  const upload = useUploadDocumentAsset(projectKey, documentId);
  const images = assets.data?.filter((asset) => asset.contentType.startsWith('image/')) ?? [];

  const insert = (source: string, alt?: string) => {
    if (!insertDocumentImage(editor, editableRef.current, source, alt)) return;
    setUrl('');
    setOpen(false);
  };

  const chooseFile = (file: File | null) => {
    if (!file || !editableRef.current) return;
    setOpen(false);
    void uploadAndInsertImage(
      editor,
      file,
      (image) => upload.mutateAsync(image),
      editor.state.selection.from,
      () => editableRef.current,
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <DocumentToolbarButton label={t('image')}>
          <ImagePlus />
        </DocumentToolbarButton>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-75 p-2">
        {canUpload && (
          <>
            <input
              ref={fileInput}
              className="sr-only"
              type="file"
              accept="image/*"
              tabIndex={-1}
              aria-label={t('uploadImage')}
              onChange={(event) => {
                chooseFile(firstImageFile(event.target.files));
                event.currentTarget.value = '';
              }}
            />
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-md bg-muted/60 p-2 text-start transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => fileInput.current?.click()}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted">
                <Upload className="size-4 text-muted-foreground" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{t('uploadImage')}</span>
                <span className="block text-xs text-muted-foreground">{t('uploadImageHint')}</span>
              </span>
            </button>
          </>
        )}

        <p className="px-1 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">
          {t('imageLibrary')}
        </p>
        <DocumentImageLibrary
          loading={assets.isLoading}
          images={images}
          onInsert={(asset) => insert(asset.url, asset.filename)}
        />

        <p className="px-1 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">
          {t('externalImage')}
        </p>
        <form
          className="flex gap-2 px-1 pb-1"
          onSubmit={(event) => {
            event.preventDefault();
            insert(url);
          }}
        >
          <input
            value={url}
            type="url"
            dir="ltr"
            className="h-8 min-w-0 flex-1 rounded-md bg-muted px-2.5 text-[13px] shadow-[inset_0_0_0_1px_var(--input)] outline-none placeholder:text-muted-foreground focus-visible:shadow-[inset_0_0_0_1px_var(--ring)]"
            placeholder="https://…"
            aria-label={t('imageUrl')}
            onChange={(event) => setUrl(event.target.value)}
          />
          <Button type="submit" size="sm" className="h-8" disabled={!url.trim()}>
            {t('insert')}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
