'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import {
  Clipboard,
  File,
  FileImage,
  History,
  Hash,
  Loader2,
  Link2,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ProjectDocument } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDateTime } from '@/utils/dates';
import { issuePath } from '@/utils/paths';
import IssuePickerDialog from '@/components/common/overlay/IssuePickerDialog';
import ArchivedBadge from '@/components/common/ArchivedBadge';
import { useTranslations } from 'next-intl';
import {
  useDeleteDocumentAsset,
  useDocumentAssetsQuery,
  useDocumentIssueLinksQuery,
  useLinkDocumentIssue,
  useUnlinkDocumentIssue,
  useUploadDocumentAsset,
} from '../services/documents.service';

type OutlineItem = { level: number; position: number; text: string };

export default function DocumentSidePanel({
  projectKey,
  document,
  editor,
  authorNames,
  canUpload,
  canDeleteAssets,
  canReadWorkItems,
  canLinkWorkItems,
  onOpenHistory,
}: {
  projectKey: string;
  document: ProjectDocument;
  editor: Editor | null;
  authorNames: Record<string, string>;
  canUpload: boolean;
  canDeleteAssets: boolean;
  canReadWorkItems: boolean;
  canLinkWorkItems: boolean;
  onOpenHistory: () => void;
}) {
  const t = useTranslations('documents');
  const fileInput = useRef<HTMLInputElement>(null);
  const [outlineRevision, setOutlineRevision] = useState(0);
  const [issuePickerOpen, setIssuePickerOpen] = useState(false);
  const assets = useDocumentAssetsQuery(projectKey, document.id);
  const issueLinks = useDocumentIssueLinksQuery(projectKey, document.id, canReadWorkItems);
  const upload = useUploadDocumentAsset(projectKey, document.id);
  const remove = useDeleteDocumentAsset(projectKey, document.id);
  const linkIssue = useLinkDocumentIssue(projectKey);
  const unlinkIssue = useUnlinkDocumentIssue(projectKey);
  const linkedIssueIds = new Set((issueLinks.data ?? []).map((link) => link.issueId));

  useEffect(() => {
    if (!editor) return;
    const refreshOutline = () => setOutlineRevision((value) => value + 1);
    editor.on('transaction', refreshOutline);
    return () => {
      editor.off('transaction', refreshOutline);
    };
  }, [editor]);

  const outline = useMemo(() => {
    void outlineRevision;
    const items: OutlineItem[] = [];
    editor?.state.doc.descendants((node, position) => {
      if (node.type.name !== 'heading') return;
      items.push({
        level: Number(node.attrs.level) || 1,
        position: position + 1,
        text: node.textContent.trim(),
      });
    });
    return items;
  }, [editor, outlineRevision]);

  const jumpToHeading = (position: number) => {
    if (!editor || editor.isDestroyed) return;
    const chain = editor.chain().setTextSelection(position).scrollIntoView();
    if (editor.isEditable) chain.focus();
    chain.run();
  };

  const insertAsset = (asset: { contentType: string; filename: string; url: string }) => {
    if (!canUpload || !editor || editor.isDestroyed || !editor.isEditable) return;
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

  const copyAsset = async (url: string) => {
    const copied = await copyText(new URL(url, window.location.origin).toString());
    if (copied) toast.success(t('assetLinkCopied'));
  };

  return (
    <Tabs defaultValue="outline" className="min-h-0 flex-1 gap-0">
      <TabsList variant="line" className="h-11 w-full shrink-0 justify-start overflow-x-auto px-3">
        <TabsTrigger value="outline">{t('outline')}</TabsTrigger>
        <TabsTrigger value="info">{t('info')}</TabsTrigger>
        {canReadWorkItems && (
          <TabsTrigger value="workItems">
            {t('linkWorkItem.tab')}
            {linkedIssueIds.size > 0 && (
              <span className="ms-1 text-muted-foreground tabular-nums">{linkedIssueIds.size}</span>
            )}
          </TabsTrigger>
        )}
        <TabsTrigger value="assets">{t('assets')}</TabsTrigger>
      </TabsList>

      <TabsContent value="outline" className="min-h-0 overflow-y-auto p-3">
        {outline.length === 0 ? (
          <p className="px-4 py-10 text-center text-xs leading-5 text-muted-foreground">
            {t('outlineEmpty')}
          </p>
        ) : (
          <nav aria-label={t('outline')}>
            <ol className="space-y-0.5">
              {outline.map((item) => (
                <li key={item.position}>
                  <button
                    type="button"
                    className="w-full truncate rounded-md py-1.5 pe-2 text-start text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    style={{ paddingInlineStart: `${8 + (item.level - 1) * 12}px` }}
                    dir="auto"
                    onClick={() => jumpToHeading(item.position)}
                  >
                    {item.text || t('untitledHeading')}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        )}
      </TabsContent>

      <TabsContent value="info" className="min-h-0 overflow-y-auto px-4 py-5">
        <dl className="divide-y text-xs">
          <div className="flex items-start justify-between gap-4 py-3 first:pt-0">
            <dt className="text-muted-foreground">{t('owner')}</dt>
            <dd className="max-w-[60%] truncate text-end font-medium" dir="auto">
              {document.ownerUserId
                ? (authorNames[document.ownerUserId] ?? t('unknownAuthor'))
                : t('unknownAuthor')}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4 py-3">
            <dt className="text-muted-foreground">{t('privacy')}</dt>
            <dd className="font-medium">
              {document.isPrivate ? t('privatePage') : t('projectAccess')}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4 py-3">
            <dt className="text-muted-foreground">{t('createdAt')}</dt>
            <dd className="text-end font-medium">
              <time dateTime={document.createdAt}>{formatDateTime(document.createdAt)}</time>
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4 py-3">
            <dt className="text-muted-foreground">{t('updatedAt')}</dt>
            <dd className="text-end font-medium">
              <time dateTime={document.updatedAt}>{formatDateTime(document.updatedAt)}</time>
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4 py-3">
            <dt className="text-muted-foreground">{t('version')}</dt>
            <dd className="font-mono font-medium">{document.version}</dd>
          </div>
        </dl>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-5 w-full"
          onClick={onOpenHistory}
        >
          <History />
          {t('versionHistory')}
        </Button>
      </TabsContent>

      {canReadWorkItems && (
        <TabsContent value="workItems" className="min-h-0 overflow-y-auto p-3">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <p className="text-xs leading-4 text-muted-foreground">
              {t('linkWorkItem.description')}
            </p>
            {canLinkWorkItems && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={linkIssue.isPending}
                onClick={() => setIssuePickerOpen(true)}
              >
                <Plus />
                {t('linkWorkItem.add')}
              </Button>
            )}
          </div>

          {issueLinks.isLoading ? (
            <div className="space-y-1.5" aria-hidden>
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : issueLinks.isError ? (
            <button
              type="button"
              className="w-full rounded-md border border-dashed px-3 py-6 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => void issueLinks.refetch()}
            >
              {t('linkWorkItem.loadFailed')}
            </button>
          ) : issueLinks.data?.length ? (
            <ul className="space-y-1.5">
              {issueLinks.data.map((link) => {
                const removing =
                  unlinkIssue.isPending && unlinkIssue.variables?.issueId === link.issueId;
                return (
                  <li
                    key={link.issueId}
                    className="group flex items-center gap-2 rounded-lg border bg-card/40 px-2.5 py-2"
                  >
                    <Link
                      href={issuePath(projectKey, link.sequenceNumber)}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <span className="grid size-7 shrink-0 place-items-center rounded-md border bg-muted/30">
                        <Hash className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium" dir="auto">
                          {link.title}
                        </span>
                        <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                          {link.identifier}
                        </span>
                      </span>
                      {link.archived && <ArchivedBadge />}
                    </Link>
                    {canLinkWorkItems && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="shrink-0 text-muted-foreground opacity-100 hover:text-destructive sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
                        aria-label={t('linkWorkItem.remove', { identifier: link.identifier })}
                        disabled={unlinkIssue.isPending}
                        onClick={() =>
                          unlinkIssue.mutate({ documentId: document.id, issueId: link.issueId })
                        }
                      >
                        {removing ? <Loader2 className="animate-spin" /> : <X />}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="rounded-lg border border-dashed px-4 py-8 text-center">
              <Link2 className="mx-auto size-5 text-muted-foreground" />
              <p className="mt-2 text-xs text-muted-foreground">{t('linkWorkItem.empty')}</p>
            </div>
          )}
        </TabsContent>
      )}

      <TabsContent value="assets" className="min-h-0 overflow-y-auto p-3">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <p className="text-xs leading-4 text-muted-foreground">{t('assetsDescription')}</p>
          {canUpload && (
            <>
              <input
                ref={fileInput}
                className="sr-only"
                type="file"
                aria-label={t('uploadAsset')}
                disabled={upload.isPending}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.currentTarget.value = '';
                  if (file) upload.mutate(file);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={upload.isPending}
                onClick={() => fileInput.current?.click()}
              >
                {upload.isPending ? <Loader2 className="animate-spin" /> : <Upload />}
                {t('upload')}
              </Button>
            </>
          )}
        </div>

        {assets.isLoading ? (
          <div className="space-y-1.5" aria-hidden>
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : assets.isError ? (
          <div className="py-10 text-center" role="alert">
            <p className="text-xs text-muted-foreground">{t('assetsLoadFailed')}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => void assets.refetch()}
            >
              <RefreshCw />
              {t('reload')}
            </Button>
          </div>
        ) : assets.data?.length ? (
          <ul className="divide-y">
            {assets.data.map((asset) => {
              const isImage = asset.contentType.startsWith('image/');
              const deleting = remove.isPending && remove.variables === asset.id;
              return (
                <li key={asset.id} className="group flex items-center gap-2 py-2 first:pt-0">
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element -- authenticated assets cannot use Next's public image optimizer.
                    <img
                      src={asset.url}
                      alt=""
                      className="size-9 shrink-0 rounded-md border object-cover"
                    />
                  ) : (
                    <span className="grid size-9 shrink-0 place-items-center rounded-md border bg-muted/30">
                      <File className="size-4 text-muted-foreground" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium" dir="auto">
                      {asset.filename}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {formatBytes(asset.sizeBytes)}
                    </span>
                  </span>
                  <span className="flex shrink-0 opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                    {editor?.isEditable && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={t('insertAsset', { name: asset.filename })}
                        onClick={() => insertAsset(asset)}
                      >
                        {isImage ? <FileImage /> : <Plus />}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t('copyAssetLink', { name: asset.filename })}
                      onClick={() => void copyAsset(asset.url)}
                    >
                      <Clipboard />
                    </Button>
                    {canDeleteAssets && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="text-destructive"
                        disabled={remove.isPending}
                        aria-label={t('deleteAsset', { name: asset.filename })}
                        onClick={() => {
                          if (window.confirm(t('deleteAssetConfirm', { name: asset.filename }))) {
                            remove.mutate(asset.id);
                          }
                        }}
                      >
                        {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
                      </Button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-4 py-10 text-center text-xs text-muted-foreground">{t('noAssets')}</p>
        )}
      </TabsContent>

      {issuePickerOpen && (
        <IssuePickerDialog
          projectKey={projectKey}
          title={t('linkWorkItem.selectIssue')}
          prompt={t('linkWorkItem.searchIssues')}
          exclude={(hit) => linkedIssueIds.has(hit.id)}
          onClose={() => setIssuePickerOpen(false)}
          onPick={(hit) => {
            void linkIssue
              .mutateAsync({ documentId: document.id, issueId: hit.id })
              .then(() => setIssuePickerOpen(false))
              .catch(() => undefined);
          }}
        />
      )}
    </Tabs>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const input = window.document.createElement('textarea');
    input.value = value;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    try {
      window.document.body.append(input);
      input.select();
      return window.document.execCommand('copy');
    } catch {
      return false;
    } finally {
      input.remove();
    }
  }
}
