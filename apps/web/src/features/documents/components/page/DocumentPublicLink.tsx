'use client';

import Link from 'next/link';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { ProjectDocument, ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { documentPath } from '@/utils/paths';
import {
  useDisableDocumentShare,
  useDocumentsSharedWithSubpages,
  useEnableDocumentShare,
} from '../../services/documents.service';
import { sharedThroughAncestor } from '../../utils/documentAccess';
import DocumentAccessSection from './DocumentAccessSection';
import DocumentPublicLinkSettings from './DocumentPublicLinkSettings';
import DocumentShareToggle from './DocumentShareToggle';

const NOTE = 'mt-2.5 text-[13px] leading-[1.45] text-muted-foreground';

// The page's public link: anyone with it can read the page without an account.
export default function DocumentPublicLink({
  projectKey,
  document,
  ancestors,
  sharingEnabled,
  projectPagesOnly,
  onClose,
}: {
  projectKey: string;
  document: ProjectDocument;
  ancestors: ProjectDocumentSummary[];
  sharingEnabled: boolean;
  // The page, or the change waiting for confirmation, is not open to the whole project.
  projectPagesOnly: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('documents');
  const enable = useEnableDocumentShare(projectKey, document.id);
  const disable = useDisableDocumentShare(projectKey, document.id);
  const on = document.shareToken !== null;
  const available = sharingEnabled && !projectPagesOnly;
  const { data: sharedWithSubpages } = useDocumentsSharedWithSubpages(
    projectKey,
    available && !on && ancestors.length > 0,
  );
  const via =
    !on && sharedWithSubpages ? sharedThroughAncestor(ancestors, sharedWithSubpages) : null;
  const busy = enable.isPending || disable.isPending;

  function setShared(next: boolean) {
    if (next) {
      enable.mutate(
        { includeChildren: false, includeIssues: false },
        { onSuccess: () => toast.success(t('publicLink.created')) },
      );
    } else {
      disable.mutate(undefined, { onSuccess: () => toast.success(t('publicLink.stopped')) });
    }
  }

  return (
    <DocumentAccessSection
      label={t('publicLink.title')}
      badge={on && available ? t('publicLink.on') : null}
    >
      {!sharingEnabled ? (
        <p className={NOTE}>{t('publicLink.turnedOff')}</p>
      ) : projectPagesOnly ? (
        <p className={NOTE}>{t('publicLink.projectPagesOnly')}</p>
      ) : (
        <>
          <DocumentShareToggle
            label={t('sharePublicly')}
            hint={t('publicLink.hint')}
            checked={on}
            disabled={busy}
            onCheckedChange={setShared}
          />
          {via && (
            <p className={NOTE}>
              {t.rich('publicLink.publicThrough', {
                title: via.title || t('untitled'),
                page: (chunks) => (
                  <Link
                    href={documentPath(projectKey, via.id)}
                    dir="auto"
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                    onClick={onClose}
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          )}
          {document.shareToken !== null && (
            <DocumentPublicLinkSettings
              projectKey={projectKey}
              document={document}
              token={document.shareToken}
              busy={busy}
              onChange={(options) => enable.mutateAsync(options)}
            />
          )}
        </>
      )}
    </DocumentAccessSection>
  );
}
