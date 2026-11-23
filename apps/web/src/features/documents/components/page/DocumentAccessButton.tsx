'use client';

import { Globe } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectDocument, ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DOCUMENT_ACCESS_ICON } from '../../utils/documentAccess';
import DocumentAccessPanel from './DocumentAccessPanel';
import DocumentIconButton from '../DocumentIconButton';

// Who can open the page and its public link, in one popover. The header shows the widest
// way in: a public link beats the page's own access.
export default function DocumentAccessButton({
  projectKey,
  document,
  ancestors,
  canChange,
  canShare,
  sharingEnabled,
  disabled,
  open,
  onOpenChange,
  onChange,
}: {
  projectKey: string;
  document: ProjectDocument;
  ancestors: ProjectDocumentSummary[];
  canChange: boolean;
  canShare: boolean;
  sharingEnabled: boolean;
  disabled: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (isPrivate: boolean, memberIds?: string[]) => void;
}) {
  const t = useTranslations('documents');
  if (document.archivedAt !== null) return null;

  const linkOn = document.shareToken !== null && sharingEnabled;
  const state = linkOn ? t('access.state.link') : t(`access.state.${document.visibility}`);
  const Icon = linkOn ? Globe : DOCUMENT_ACCESS_ICON[document.visibility];

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <DocumentIconButton label={t('access.trigger', { state })} title={state}>
          <Icon />
        </DocumentIconButton>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        aria-label={t('sharePage')}
        className="w-[min(380px,calc(100vw-32px))] rounded-lg p-0"
      >
        <DocumentAccessPanel
          projectKey={projectKey}
          document={document}
          ancestors={ancestors}
          canChange={canChange}
          canShare={canShare}
          sharingEnabled={sharingEnabled}
          disabled={disabled}
          onClose={() => onOpenChange(false)}
          onChange={onChange}
        />
      </PopoverContent>
    </Popover>
  );
}
