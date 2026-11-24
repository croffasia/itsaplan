'use client';

import { PinOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { usePermissions } from '@/hooks/usePermissions';
import { useDocumentPin } from '../../hooks/useDocumentPin';
import DocumentIconButton from '../DocumentIconButton';

// Takes a pinned page off the Docs home, from the corner of its card.
export default function DocumentsHomeUnpinButton({
  projectKey,
  page,
}: {
  projectKey: string;
  page: ProjectDocumentSummary;
}) {
  const t = useTranslations('documents');
  const canPin = usePermissions().can('documents', 'edit');
  const pin = useDocumentPin(projectKey);
  if (!canPin) return null;

  return (
    <DocumentIconButton
      label={t('unpinPage')}
      disabled={pin.pending}
      className="absolute end-3 top-3 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
      onClick={() => pin.setPinned(page, false)}
    >
      <PinOff />
    </DocumentIconButton>
  );
}
