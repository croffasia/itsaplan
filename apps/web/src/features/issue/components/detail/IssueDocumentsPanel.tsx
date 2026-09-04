'use client';

import Link from 'next/link';
import { useState } from 'react';
import { FileText, Loader2, Lock, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ArchivedBadge from '@/components/common/ArchivedBadge';
import { documentPath } from '@/utils/paths';
import DocumentPickerDialog from '@/features/documents/components/DocumentPickerDialog';
import {
  useIssueDocumentLinksQuery,
  useLinkDocumentIssue,
  useUnlinkDocumentIssue,
} from '@/features/documents/services/documents.service';
import { useTranslations } from 'next-intl';
import { usePersistedOpen } from '../../hooks/usePersistedOpen';
import IssueSectionHeading from './IssueSectionHeading';

export default function IssueDocumentsPanel({
  projectKey,
  issueId,
  canRead,
  canLink,
}: {
  projectKey: string;
  issueId: number;
  canRead: boolean;
  canLink: boolean;
}) {
  const t = useTranslations('issue.documents');
  const { open, toggle } = usePersistedOpen('issue-documents-open');
  const [pickerOpen, setPickerOpen] = useState(false);
  const links = useIssueDocumentLinksQuery(projectKey, issueId, canRead);
  const linkDocument = useLinkDocumentIssue(projectKey);
  const unlinkDocument = useUnlinkDocumentIssue(projectKey);
  const linkedIds = new Set((links.data ?? []).map((link) => link.documentId));

  if (!canRead || (!links.isLoading && !links.isError && linkedIds.size === 0 && !canLink)) {
    return null;
  }

  return (
    <div className={`mt-6 border-t pt-5 ${open ? '' : '-mb-2'}`}>
      <div className={`flex h-7 items-center gap-2 ${open ? 'mb-3' : ''}`}>
        <IssueSectionHeading
          label={t('title')}
          tally={linkedIds.size > 0 ? String(linkedIds.size) : undefined}
          open={open}
          onToggle={toggle}
        />
        {canLink && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="ms-auto"
            aria-label={t('add')}
            title={t('add')}
            disabled={linkDocument.isPending}
            onClick={() => setPickerOpen(true)}
          >
            <Plus />
          </Button>
        )}
      </div>

      {open && (
        <div className="space-y-1.5">
          {links.isLoading ? (
            <div className="flex h-12 items-center justify-center text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : links.isError ? (
            <button
              type="button"
              className="w-full rounded-md border border-dashed px-3 py-4 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => void links.refetch()}
            >
              {t('loadFailed')}
            </button>
          ) : links.data?.length ? (
            links.data.map((link) => {
              const removing =
                unlinkDocument.isPending &&
                unlinkDocument.variables?.documentId === link.documentId;
              return (
                <div
                  key={link.documentId}
                  className="group flex items-center gap-2 rounded-lg border bg-card/40 px-2.5 py-2"
                >
                  <Link
                    href={documentPath(projectKey, link.documentId)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-md border bg-muted/30 text-sm">
                      {link.icon || <FileText className="size-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm" dir="auto">
                      {link.title.trim() || t('untitled')}
                    </span>
                    {link.isPrivate && <Lock className="size-3.5 text-muted-foreground" />}
                    {link.archived && <ArchivedBadge />}
                  </Link>
                  {canLink && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="shrink-0 text-muted-foreground opacity-100 hover:text-destructive sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
                      aria-label={t('remove', { title: link.title || t('untitled') })}
                      disabled={unlinkDocument.isPending}
                      onClick={() =>
                        unlinkDocument.mutate({ documentId: link.documentId, issueId })
                      }
                    >
                      {removing ? <Loader2 className="animate-spin" /> : <X />}
                    </Button>
                  )}
                </div>
              );
            })
          ) : (
            <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
              {t('empty')}
            </p>
          )}
        </div>
      )}

      {pickerOpen && (
        <DocumentPickerDialog
          projectKey={projectKey}
          linkedDocumentIds={linkedIds}
          onClose={() => setPickerOpen(false)}
          onPick={(document) => {
            void linkDocument
              .mutateAsync({ documentId: document.id, issueId })
              .then(() => setPickerOpen(false))
              .catch(() => undefined);
          }}
        />
      )}
    </div>
  );
}
