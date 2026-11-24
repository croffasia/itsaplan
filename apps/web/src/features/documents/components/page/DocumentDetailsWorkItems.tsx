'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import IssuePickerDialog from '@/components/common/overlay/IssuePickerDialog';
import {
  useDocumentIssueLinksQuery,
  useLinkDocumentIssue,
  useUnlinkDocumentIssue,
} from '../../services/documents.service';
import DocumentDetailsSection from './DocumentDetailsSection';
import DocumentWorkItemRow from './DocumentWorkItemRow';

// The work items that use this page as context.
export default function DocumentDetailsWorkItems({
  projectKey,
  documentId,
  canLink,
}: {
  projectKey: string;
  documentId: number;
  canLink: boolean;
}) {
  const t = useTranslations('documents');
  const [pickerOpen, setPickerOpen] = useState(false);
  const links = useDocumentIssueLinksQuery(projectKey, documentId);
  const link = useLinkDocumentIssue(projectKey);
  const unlink = useUnlinkDocumentIssue(projectKey);
  const linkedIds = new Set((links.data ?? []).map((item) => item.issueId));

  return (
    <DocumentDetailsSection
      id="work"
      title={t('linkWorkItem.tab')}
      count={linkedIds.size}
      action={
        canLink && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-muted-foreground"
            disabled={link.isPending}
            onClick={() => setPickerOpen(true)}
          >
            <Plus />
            {t('linkWorkItem.add')}
          </Button>
        )
      }
    >
      {links.isLoading ? (
        <div className="space-y-1" aria-hidden>
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : links.isError ? (
        <button
          type="button"
          className="block w-full rounded-md p-4 text-center text-sm text-destructive outline-1 -outline-offset-1 outline-destructive/40 outline-dashed"
          onClick={() => void links.refetch()}
        >
          {t('linkWorkItem.loadFailed')}
        </button>
      ) : links.data?.length ? (
        <ul>
          {links.data.map((item) => (
            <DocumentWorkItemRow
              key={item.issueId}
              projectKey={projectKey}
              item={item}
              removing={unlink.isPending && unlink.variables?.issueId === item.issueId}
              disabled={unlink.isPending}
              onRemove={
                canLink ? () => unlink.mutate({ documentId, issueId: item.issueId }) : undefined
              }
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-md p-4 text-center text-sm text-muted-foreground outline-1 -outline-offset-1 outline-input outline-dashed">
          {t('linkWorkItem.empty')}
        </p>
      )}

      {pickerOpen && (
        <IssuePickerDialog
          projectKey={projectKey}
          title={t('linkWorkItem.selectIssue')}
          prompt={t('linkWorkItem.searchIssues')}
          exclude={(hit) => linkedIds.has(hit.id)}
          onClose={() => setPickerOpen(false)}
          onPick={(hit) => {
            void link
              .mutateAsync({ documentId, issueId: hit.id })
              .then(() => setPickerOpen(false))
              .catch(() => undefined);
          }}
        />
      )}
    </DocumentDetailsSection>
  );
}
