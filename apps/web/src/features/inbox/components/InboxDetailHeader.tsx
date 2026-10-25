'use client';

import Link from 'next/link';
import { ChevronLeft, Maximize2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Notification } from '@/lib/api/endpoints/notifications';
import { Button } from '@/components/ui/button';
import { documentPath, issuePath, splitProjectRef } from '@/utils/paths';

export default function InboxDetailHeader({
  projectKey,
  notification: n,
  isMobile,
  onBack,
}: {
  projectKey: string;
  notification: Pick<Notification, 'issueSeq' | 'documentId' | 'documentTitle'>;
  isMobile: boolean;
  onBack: () => void;
}) {
  const t = useTranslations('inbox');
  const tIssue = useTranslations('issue');
  const tDocuments = useTranslations('documents');
  const openLabel = tIssue('openAsPage');
  const { label, href } =
    n.documentId != null
      ? {
          label: n.documentTitle?.trim() || tDocuments('untitled'),
          href: documentPath(projectKey, n.documentId),
        }
      : {
          label: `${splitProjectRef(projectKey).key}-${n.issueSeq}`,
          href: issuePath(projectKey, n.issueSeq!),
        };

  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b px-4 sm:px-6 xl:px-10">
      {isMobile && (
        <Button variant="ghost" size="sm" className="-ms-2 gap-1.5" onClick={onBack}>
          <ChevronLeft aria-hidden="true" className="size-4 rtl:rotate-180" />
          {t('backToList')}
        </Button>
      )}
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{label}</span>
      <Button
        asChild
        variant="ghost"
        size="icon"
        className="size-9 text-muted-foreground hover:text-foreground sm:size-7"
      >
        <Link href={href} title={openLabel} aria-label={openLabel}>
          <Maximize2 aria-hidden="true" />
        </Link>
      </Button>
    </div>
  );
}
