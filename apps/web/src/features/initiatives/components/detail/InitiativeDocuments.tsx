'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import DocumentLinkList from '@/components/common/DocumentLinkList';
import { usePermissions } from '@/hooks/usePermissions';
import DocumentPickerDialog from '@/features/documents/components/DocumentPickerDialog';
import {
  useInitiativeDocumentLinksQuery,
  useLinkDocumentInitiative,
  useUnlinkDocumentInitiative,
} from '@/features/documents/services/documents.service';

// The Docs pages linked to an initiative, beside its description. Mirrors the
// issue's Docs section.
export default function InitiativeDocuments({
  projectKey,
  initiativeId,
}: {
  projectKey: string;
  initiativeId: number;
}) {
  const t = useTranslations('initiatives.documents');
  const { can } = usePermissions();
  const canRead = can('documents', 'read');
  const canLink = canRead && can('documents', 'edit') && can('initiatives', 'edit');
  const [pickerOpen, setPickerOpen] = useState(false);
  const links = useInitiativeDocumentLinksQuery(projectKey, initiativeId, canRead);
  const link = useLinkDocumentInitiative(projectKey);
  const unlink = useUnlinkDocumentInitiative(projectKey);
  const linkedIds = new Set((links.data ?? []).map((l) => l.documentId));

  if (!canRead) return null;

  return (
    <div>
      <div className="flex h-7 items-center gap-2">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {t('title')}
        </h2>
        {linkedIds.size > 0 && (
          <span className="text-xs text-muted-foreground">{linkedIds.size}</span>
        )}
        {canLink && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="ms-auto"
            aria-label={t('add')}
            title={t('add')}
            disabled={link.isPending}
            onClick={() => setPickerOpen(true)}
          >
            <Plus />
          </Button>
        )}
      </div>

      <DocumentLinkList
        className="mt-3"
        namespace="initiatives.documents"
        projectKey={projectKey}
        links={links}
        canUnlink={canLink}
        unlinkingId={unlink.isPending ? (unlink.variables?.documentId ?? null) : null}
        onUnlink={(documentId) => unlink.mutate({ documentId, initiativeId })}
      />

      {pickerOpen && (
        <DocumentPickerDialog
          projectKey={projectKey}
          linkedDocumentIds={linkedIds}
          onClose={() => setPickerOpen(false)}
          onPick={(document) => {
            void link
              .mutateAsync({ documentId: document.id, initiativeId })
              .then(() => setPickerOpen(false))
              .catch(() => undefined);
          }}
        />
      )}
    </div>
  );
}
