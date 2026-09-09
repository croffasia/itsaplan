'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DocumentLinkList from '@/components/common/DocumentLinkList';
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
        <DocumentLinkList
          namespace="issue.documents"
          projectKey={projectKey}
          links={links}
          canUnlink={canLink}
          unlinkingId={
            unlinkDocument.isPending ? (unlinkDocument.variables?.documentId ?? null) : null
          }
          onUnlink={(documentId) => unlinkDocument.mutate({ documentId, issueId })}
        />
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
