import { ArrowLeft, Check, CircleAlert, LoaderCircle, PanelRight, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectDocument, ProjectDocumentSummary } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DocumentSaveState } from '../hooks/useDocumentDraft';
import DocumentBreadcrumbs from './DocumentBreadcrumbs';
import DocumentCopyLinkButton from './DocumentCopyLinkButton';
import DocumentFavoriteButton from './DocumentFavoriteButton';
import DocumentLockButton from './DocumentLockButton';
import DocumentOptionsMenu from './DocumentOptionsMenu';

export default function DocumentEditorHeader({
  projectKey,
  projectName,
  document,
  ancestors,
  title,
  content,
  richHtml,
  saveState,
  dirty,
  stickyToolbar,
  canCreate,
  canUpdate,
  canManage,
  canManageLifecycle,
  canDelete,
  busy,
  onBack,
  onRetrySave,
  onFullWidthChange,
  onStickyToolbarChange,
  onCreateChild,
  onDuplicate,
  onFavoriteChange,
  onLockChange,
  onPrivacyChange,
  onArchive,
  onRestore,
  onDelete,
  inspectorOpen,
  onInspectorOpenChange,
  onOpenHistory,
}: {
  projectKey: string;
  projectName: string;
  document: ProjectDocument;
  ancestors: ProjectDocumentSummary[];
  title: string;
  content: string;
  richHtml: string;
  saveState: DocumentSaveState;
  dirty: boolean;
  stickyToolbar: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canManage: boolean;
  canManageLifecycle: boolean;
  canDelete: boolean;
  busy: boolean;
  onBack: () => void;
  onRetrySave: () => void;
  onFullWidthChange: (value: boolean) => void;
  onStickyToolbarChange: (value: boolean) => void;
  onCreateChild: () => void;
  onDuplicate: () => void;
  onFavoriteChange: (favorite: boolean) => void;
  onLockChange: (locked: boolean) => void;
  onPrivacyChange: (isPrivate: boolean) => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
  inspectorOpen: boolean;
  onInspectorOpenChange: (open: boolean) => void;
  onOpenHistory: () => void;
}) {
  const t = useTranslations('documents');
  const readOnlyReason =
    document.archivedAt !== null
      ? t('archivedReadOnly')
      : document.isLocked
        ? t('lockedReadOnly')
        : null;
  const statusText = readOnlyReason
    ? readOnlyReason
    : saveState === 'conflict'
      ? t('conflict')
      : saveState === 'error'
        ? t('saveFailed')
        : saveState === 'saving' || dirty
          ? t('saving')
          : t('saved');
  const statusTone =
    saveState === 'error'
      ? 'text-destructive'
      : saveState === 'conflict'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-muted-foreground';

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background/90 px-2.5 backdrop-blur-md md:px-4">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0 md:hidden"
        aria-label={t('backToDocuments')}
        onClick={onBack}
      >
        <ArrowLeft className="rtl:rotate-180" />
      </Button>

      <DocumentBreadcrumbs
        projectKey={projectKey}
        projectName={projectName}
        ancestors={ancestors}
        document={document}
      />

      <div className="ms-auto flex shrink-0 items-center gap-0.5">
        <div
          className={cn(
            'me-1 flex h-7 items-center gap-1.5 px-1 text-[11px] tabular-nums',
            statusTone,
          )}
          role="status"
          aria-live="polite"
          title={statusText}
        >
          {saveState === 'error' || saveState === 'conflict' ? (
            <CircleAlert className="size-3" />
          ) : !readOnlyReason && (saveState === 'saving' || dirty) ? (
            <LoaderCircle className="size-3 animate-spin" />
          ) : (
            <Check className="size-3" />
          )}
          <span className="hidden lg:inline">{statusText}</span>
        </div>

        {saveState === 'error' && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('retrySave')}
            title={t('retrySave')}
            onClick={onRetrySave}
          >
            <RefreshCw />
          </Button>
        )}

        <DocumentFavoriteButton
          favorite={document.isFavorite}
          disabled={busy}
          onChange={onFavoriteChange}
        />
        <DocumentLockButton
          locked={document.isLocked}
          disabled={!canManage || document.archivedAt !== null || busy}
          onChange={onLockChange}
        />
        <DocumentCopyLinkButton />
        <div className="mx-1 hidden h-4 w-px bg-border sm:block" aria-hidden />
        <Button
          type="button"
          variant={inspectorOpen ? 'secondary' : 'ghost'}
          size="icon-sm"
          aria-label={inspectorOpen ? t('closeDetails') : t('openDetails')}
          aria-pressed={inspectorOpen}
          title={inspectorOpen ? t('closeDetails') : t('openDetails')}
          onClick={() => onInspectorOpenChange(!inspectorOpen)}
        >
          <PanelRight />
        </Button>
        <DocumentOptionsMenu
          projectKey={projectKey}
          document={document}
          title={title}
          content={content}
          richHtml={richHtml}
          stickyToolbar={stickyToolbar}
          canCreate={canCreate}
          canUpdate={canUpdate}
          canManage={canManage}
          canManageLifecycle={canManageLifecycle}
          canDelete={canDelete}
          busy={busy}
          onFullWidthChange={onFullWidthChange}
          onStickyToolbarChange={onStickyToolbarChange}
          onPrivacyChange={onPrivacyChange}
          onCreateChild={onCreateChild}
          onDuplicate={onDuplicate}
          onArchive={onArchive}
          onRestore={onRestore}
          onDelete={onDelete}
          onOpenHistory={onOpenHistory}
        />
      </div>
    </header>
  );
}
