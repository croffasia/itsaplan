'use client';

import DocumentLinkList from '@/components/common/DocumentLinkList';
import DocumentPickerDialog from '@/features/documents/components/DocumentPickerDialog';
import {
  useIssueDocumentLinksQuery,
  useLinkDocumentIssue,
  useUnlinkDocumentIssue,
} from '@/features/documents/services/documents.service';
import { useTranslations } from 'next-intl';
import { usePersistedOpen } from '@/hooks/usePersistedOpen';
import IssueSection from './IssueSection';
import IssueSectionAddButton from './IssueSectionAddButton';
import IssueSectionHeading from './IssueSectionHeading';

// The Docs pages linked to the issue. The section stays off the page while none is
// linked; the issue's add bar opens the same picker as the heading's button.
export default function IssueDocumentsPanel({
  projectKey,
  issueId,
  canRead,
  canLink,
  adding,
  onAddingChange,
}: {
  projectKey: string;
  issueId: number;
  canRead: boolean;
  canLink: boolean;
  // Whether the page picker is open. Held by the issue detail, whose add bar opens it
  // too.
  adding: boolean;
  onAddingChange: (adding: boolean) => void;
}) {
  const t = useTranslations('issue.documents');
  const { open, toggle } = usePersistedOpen('issue-documents-open');
  const links = useIssueDocumentLinksQuery(projectKey, issueId, canRead);
  const linkDocument = useLinkDocumentIssue(projectKey);
  const unlinkDocument = useUnlinkDocumentIssue(projectKey);
  const linkedIds = new Set((links.data ?? []).map((link) => link.documentId));

  if (!canRead) return null;

  const picker = adding && (
    <DocumentPickerDialog
      projectKey={projectKey}
      excludeIds={linkedIds}
      onClose={() => onAddingChange(false)}
      onPick={(document) => {
        void linkDocument
          .mutateAsync({ documentId: document.id, issueId })
          .then(() => onAddingChange(false))
          .catch(() => undefined);
      }}
    />
  );

  // A failed read still shows the section, so its error is not mistaken for no links.
  if (linkedIds.size === 0 && !links.isError) return picker;

  return (
    <IssueSection collapsed={!open}>
      <IssueSectionHeading
        label={t('title')}
        tally={linkedIds.size > 0 ? String(linkedIds.size) : undefined}
        open={open}
        onToggle={toggle}
        actions={
          canLink && (
            <IssueSectionAddButton
              label={t('add')}
              disabled={linkDocument.isPending}
              onClick={() => onAddingChange(true)}
            />
          )
        }
      />

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

      {picker}
    </IssueSection>
  );
}
