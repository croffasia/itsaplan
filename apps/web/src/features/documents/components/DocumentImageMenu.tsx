'use client';

import { useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { ImagePlus, Loader2, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDocumentAssetsQuery, useUploadDocumentAsset } from '../services/documents.service';
import { insertDocumentImage } from './DocumentMarkdownEditor';

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

  const chooseFile = (file: File | undefined) => {
    if (!file || !editableRef.current || !file.type.startsWith('image/')) return;
    upload.mutate(file, { onSuccess: (asset) => insert(asset.url, asset.filename) });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={t('image')}
        >
          <ImagePlus className="size-4 stroke-[1.75]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[21rem] overflow-hidden rounded-xl p-0 shadow-xl">
        <Tabs defaultValue="library" className="gap-0">
          <TabsList variant="line" className="h-11 w-full justify-start gap-4 px-4">
            <TabsTrigger value="library" className="px-0 text-xs">
              {t('imageLibrary')}
            </TabsTrigger>
            <TabsTrigger value="external" className="px-0 text-xs">
              {t('externalImage')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="library" className="p-3">
            {canUpload && (
              <>
                <input
                  ref={fileInput}
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  aria-label={t('uploadImage')}
                  onChange={(event) => {
                    chooseFile(event.target.files?.[0]);
                    event.currentTarget.value = '';
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mb-3 h-9 w-full justify-center rounded-lg border-dashed bg-muted/20 text-xs shadow-none"
                  disabled={upload.isPending}
                  onClick={() => fileInput.current?.click()}
                >
                  {upload.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  {t('uploadImage')}
                </Button>
              </>
            )}

            {assets.isLoading ? (
              <div className="grid grid-cols-3 gap-2" aria-hidden>
                {Array.from({ length: 6 }, (_, index) => (
                  <div key={index} className="aspect-square animate-pulse rounded-lg bg-muted/60" />
                ))}
              </div>
            ) : images.length > 0 ? (
              <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto pe-1" role="list">
                {images.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    className="group relative aspect-square overflow-hidden rounded-lg bg-muted ring-offset-2 ring-offset-popover transition-[opacity,transform] outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
                    title={asset.filename}
                    aria-label={t('insertImage', { name: asset.filename })}
                    onClick={() => insert(asset.url, asset.filename)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- private media uses the session-gated proxy. */}
                    <img src={asset.url} alt="" className="size-full object-cover" />
                    <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-1 text-start text-[10px] text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                      {asset.filename}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">{t('noImages')}</p>
            )}
          </TabsContent>

          <TabsContent value="external" className="p-4">
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                insert(url);
              }}
            >
              <Input
                value={url}
                type="url"
                dir="ltr"
                className="h-9 rounded-lg text-xs"
                placeholder={t('imageUrl')}
                aria-label={t('imageUrl')}
                onChange={(event) => setUrl(event.target.value)}
              />
              <Button type="submit" size="sm" className="h-9 rounded-lg" disabled={!url.trim()}>
                {t('insert')}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
