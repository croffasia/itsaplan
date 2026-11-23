'use client';

import { Pin, PinOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectDocument } from '@/lib/api/endpoints/documents';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useDocumentPin } from '../../hooks/useDocumentPin';

// Puts the page on the Docs home or takes it off. A private page is off: the home is shared.
export default function DocumentPinItem({
  projectKey,
  document,
}: {
  projectKey: string;
  document: ProjectDocument;
}) {
  const t = useTranslations('documents');
  const pin = useDocumentPin(projectKey);

  return (
    <div title={document.isPrivate ? t('pinPrivateHint') : undefined}>
      <DropdownMenuItem
        disabled={pin.pending || document.isPrivate}
        onSelect={() => pin.setPinned(document, !document.isPinned)}
      >
        {document.isPinned ? <PinOff /> : <Pin />}
        {document.isPinned ? t('unpinPage') : t('pinPage')}
      </DropdownMenuItem>
    </div>
  );
}
