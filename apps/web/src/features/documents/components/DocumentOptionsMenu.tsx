'use client';

import { useCallback, useState } from 'react';
import {
  Archive,
  Check,
  Clipboard,
  Copy,
  Download,
  Expand,
  History,
  LockKeyhole,
  MoreHorizontal,
  PanelTop,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ProjectDocument } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslations } from 'next-intl';
import DocumentExportDialog from './DocumentExportDialog';

export default function DocumentOptionsMenu({
  projectKey,
  document,
  title,
  content,
  richHtml,
  stickyToolbar,
  canCreate,
  canUpdate,
  canManage,
  canManageLifecycle,
  canDelete,
  busy,
  onFullWidthChange,
  onStickyToolbarChange,
  onPrivacyChange,
  onCreateChild,
  onDuplicate,
  onArchive,
  onRestore,
  onDelete,
  onOpenHistory,
}: {
  projectKey: string;
  document: ProjectDocument;
  title: string;
  content: string;
  richHtml: string;
  stickyToolbar: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canManage: boolean;
  canManageLifecycle: boolean;
  canDelete: boolean;
  busy: boolean;
  onFullWidthChange: (value: boolean) => void;
  onStickyToolbarChange: (value: boolean) => void;
  onPrivacyChange: (value: boolean) => void;
  onCreateChild: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onOpenHistory: () => void;
}) {
  const t = useTranslations('documents');
  const [exportOpen, setExportOpen] = useState(false);
  const archived = document.archivedAt !== null;

  const copyMarkdown = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      const input = window.document.createElement('textarea');
      input.value = content;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      try {
        window.document.body.append(input);
        input.select();
        if (!window.document.execCommand('copy')) return;
      } catch {
        return;
      } finally {
        input.remove();
      }
    }
    toast.success(t('markdownCopied'));
  }, [content, t]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('documentActions')}
            aria-busy={busy}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {canUpdate && (
            <DropdownMenuItem
              disabled={busy}
              onSelect={(event) => {
                event.preventDefault();
                onFullWidthChange(!document.fullWidth);
              }}
            >
              <Expand />
              <span className="flex-1">{t('fullWidth')}</span>
              {document.fullWidth && <Check className="text-primary" aria-hidden />}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              onStickyToolbarChange(!stickyToolbar);
            }}
          >
            <PanelTop />
            <span className="flex-1">{t('stickyToolbar')}</span>
            {stickyToolbar && <Check className="text-primary" aria-hidden />}
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void copyMarkdown()}>
            <Clipboard />
            {t('copyMarkdown')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onOpenHistory}>
            <History />
            {t('versionHistory')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setExportOpen(true)}>
            <Download />
            {t('export')}
          </DropdownMenuItem>

          {canCreate && (
            <>
              <DropdownMenuSeparator />
              {!archived && (
                <DropdownMenuItem onSelect={onCreateChild}>
                  <Plus />
                  {t('addSubpage')}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem disabled={busy} onSelect={onDuplicate}>
                <Copy />
                {t('makeCopy')}
              </DropdownMenuItem>
            </>
          )}

          {(canManage || canManageLifecycle || canDelete) && <DropdownMenuSeparator />}
          {canManage && !archived && (
            <DropdownMenuItem
              disabled={busy}
              onSelect={(event) => {
                event.preventDefault();
                onPrivacyChange(!document.isPrivate);
              }}
            >
              <LockKeyhole />
              <span className="flex-1">{t('privatePage')}</span>
              {document.isPrivate && <Check className="text-primary" aria-hidden />}
            </DropdownMenuItem>
          )}
          {canManageLifecycle && !archived && (
            <DropdownMenuItem disabled={busy || document.isLocked} onSelect={onArchive}>
              <Archive />
              {t('archive')}
            </DropdownMenuItem>
          )}
          {canManageLifecycle && archived && (
            <DropdownMenuItem disabled={busy} onSelect={onRestore}>
              <RotateCcw />
              {t('restore')}
            </DropdownMenuItem>
          )}
          {canDelete && archived && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" disabled={busy} onSelect={onDelete}>
                <Trash2 />
                {t('deletePermanently')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DocumentExportDialog
        open={exportOpen}
        projectKey={projectKey}
        documentId={document.id}
        title={title}
        content={content}
        richHtml={richHtml}
        onOpenChange={setExportOpen}
      />
    </>
  );
}
