import { FileText, Folder, Globe } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectDocument, ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { useShell } from '@/context/shellContext';
import { formatShortDate } from '@/utils/dates';
import { DOCUMENT_ACCESS_ICON } from '../../utils/documentAccess';
import DocumentDetailsGroup from './DocumentDetailsGroup';
import DocumentDetailsOwner from './DocumentDetailsOwner';
import DocumentDetailsValue from './DocumentDetailsValue';

// Who owns and sees the page, and where it sits.
export default function DocumentDetailsAccessGroup({
  projectKey,
  document,
  parent,
  open,
  onToggle,
  onTransferOwner,
  onOpenAccess,
  onMove,
}: {
  projectKey: string;
  document: ProjectDocument;
  parent: ProjectDocumentSummary | null;
  open: boolean;
  onToggle: () => void;
  onTransferOwner?: (userId: string) => void;
  onOpenAccess?: () => void;
  onMove?: () => void;
}) {
  const t = useTranslations('documents');
  const { project } = useShell();
  const archived = document.archivedAt !== null;
  const AccessIcon = DOCUMENT_ACCESS_ICON[document.visibility];
  const LocationIcon = parent ? FileText : Folder;
  const shared = Boolean(document.shareToken) && !archived && Boolean(project?.sharingEnabled);
  const owner =
    project?.assignees.find((assignee) => assignee.userId === document.ownerUserId) ?? null;

  return (
    <DocumentDetailsGroup
      label={t('privacy')}
      open={open}
      onToggle={onToggle}
      rows={[
        [
          t('owner'),
          <DocumentDetailsOwner
            key="owner"
            projectKey={projectKey}
            ownerId={document.ownerUserId}
            name={owner?.name ?? t('unknownAuthor')}
            image={owner?.image ?? null}
            onTransfer={onTransferOwner}
          />,
        ],
        [
          t('privacy'),
          <DocumentDetailsValue
            key="access"
            interactive={Boolean(onOpenAccess)}
            onClick={onOpenAccess}
          >
            <AccessIcon />
            <span className="truncate">
              {document.visibility === 'restricted'
                ? t('inspector.people', { count: document.memberIds.length + 1 })
                : t(`access.state.${document.visibility}`)}
            </span>
          </DocumentDetailsValue>,
        ],
        [
          t('publicLink.title'),
          shared ? (
            <DocumentDetailsValue
              key="link"
              interactive={Boolean(onOpenAccess)}
              onClick={onOpenAccess}
            >
              <Globe />
              {t('publicLink.on')}
              <span className="truncate text-muted-foreground">
                {document.shareExpiresAt
                  ? t('inspector.until', { date: formatShortDate(document.shareExpiresAt) })
                  : t('inspector.noExpiry')}
              </span>
            </DocumentDetailsValue>
          ) : (
            <DocumentDetailsValue key="link" interactive={false}>
              <span className="truncate text-muted-foreground">{t('inspector.off')}</span>
            </DocumentDetailsValue>
          ),
        ],
        [
          t('inspector.location'),
          <DocumentDetailsValue
            key="location"
            interactive={Boolean(onMove)}
            title={t('moveTo')}
            onClick={onMove}
          >
            {parent?.icon ? <span aria-hidden>{parent.icon}</span> : <LocationIcon />}
            <span className="truncate" dir="auto">
              {parent ? parent.title.trim() || t('untitled') : t('topLevel')}
            </span>
          </DocumentDetailsValue>,
        ],
      ]}
    />
  );
}
