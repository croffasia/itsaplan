'use client';

import type { ReactNode } from 'react';
import { Clock3, Globe, Hash } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectDocument } from '@/lib/api/endpoints/documents';
import Avatar from '@/components/common/Avatar';
import { useRelativeTime } from '@/context/relativeTimeContext';
import { useDocumentIssueLinksQuery } from '../../services/documents.service';
import { DOCUMENT_ACCESS_ICON } from '../../utils/documentAccess';

const CHIP =
  'inline-flex h-7 items-center gap-1.5 rounded-full bg-muted/70 ps-2 pe-2.5 [&_svg]:size-3.5 [&_svg]:shrink-0';
const BUTTON_CHIP = `${CHIP} transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`;

// A chip is a button only where it leads somewhere the user may act.
function chip(content: ReactNode, onClick?: () => void) {
  return onClick ? (
    <button type="button" className={BUTTON_CHIP} onClick={onClick}>
      {content}
    </button>
  ) : (
    <span className={CHIP}>{content}</span>
  );
}

export default function DocumentPageProperties({
  projectKey,
  document,
  owner,
  ownerIsYou,
  interactive,
  publicLinkOn,
  canReadWorkItems,
  onOpenDetails,
  onOpenAccess,
}: {
  projectKey: string;
  document: ProjectDocument;
  owner: { name: string; image: string | null } | null;
  ownerIsYou: boolean;
  interactive: boolean;
  publicLinkOn: boolean;
  canReadWorkItems: boolean;
  onOpenDetails: (section?: 'work') => void;
  // Left out when the page has no access popover, as on an archived page.
  onOpenAccess?: () => void;
}) {
  const t = useTranslations('documents');
  const relativeTime = useRelativeTime();
  const workItems = useDocumentIssueLinksQuery(projectKey, document.id, canReadWorkItems);
  const workItemCount = workItems.data?.length ?? 0;
  const AccessIcon = DOCUMENT_ACCESS_ICON[document.visibility];
  const accessLabel = {
    public: t('projectAccess'),
    private: t('access.state.private'),
    restricted: t('peopleCount', { count: document.memberIds.length + 1 }),
  }[document.visibility];

  return (
    <div className="flex flex-wrap gap-1.5 text-[13px] text-muted-foreground">
      {owner &&
        chip(
          <>
            <Avatar name={owner.name} image={owner.image} className="size-[18px] text-[8px]" />
            <span dir="auto">{ownerIsYou ? t('access.you') : owner.name}</span>
          </>,
          interactive ? () => onOpenDetails() : undefined,
        )}
      {chip(
        <>
          <AccessIcon />
          {accessLabel}
        </>,
        onOpenAccess,
      )}
      {publicLinkOn &&
        onOpenAccess &&
        chip(
          <>
            <Globe />
            {t('publicLink.title')}
          </>,
          onOpenAccess,
        )}
      {chip(
        <>
          <Clock3 />
          {t('updated', { time: relativeTime(document.updatedAt) })}
        </>,
      )}
      {workItemCount > 0 &&
        chip(
          <>
            <Hash />
            {t('workItemsCount', { count: workItemCount })}
          </>,
          interactive ? () => onOpenDetails('work') : undefined,
        )}
    </div>
  );
}
