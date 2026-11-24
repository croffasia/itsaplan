'use client';

import { useState } from 'react';
import { Pin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/page/EmptyState';
import { useDocumentPin } from '../../hooks/useDocumentPin';
import DocumentPickerDialog from '../DocumentPickerDialog';

export default function DocumentsHomePinnedEmpty({
  projectKey,
  documents,
}: {
  projectKey: string;
  documents: ProjectDocumentSummary[];
}) {
  const t = useTranslations('documents');
  const canPin = usePermissions().can('documents', 'edit');
  const pin = useDocumentPin(projectKey);
  const [picking, setPicking] = useState(false);
  // Only a page the whole project can open goes on the shared home.
  const excludeIds = new Set(documents.filter((d) => d.isPrivate).map((d) => d.id));

  if (!canPin) {
    return (
      <EmptyState title={t('home.pinnedEmptyTitle')} description={t('home.pinnedEmptyReader')} />
    );
  }

  return (
    <EmptyState title={t('home.pinnedEmptyTitle')} description={t('home.pinnedEmptyEditor')}>
      <Button type="button" variant="ghost" size="sm" onClick={() => setPicking(true)}>
        <Pin />
        {t('home.pinPage')}
      </Button>
      {picking && (
        <DocumentPickerDialog
          projectKey={projectKey}
          excludeIds={excludeIds}
          title={t('home.pinPickerTitle')}
          emptyText={t('home.pinPickerEmpty')}
          onClose={() => setPicking(false)}
          onPick={(document) => {
            setPicking(false);
            pin.setPinned(document, true);
          }}
        />
      )}
    </EmptyState>
  );
}
