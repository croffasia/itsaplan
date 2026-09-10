'use client';

import Link from 'next/link';
import { ChevronLeft, Maximize2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { issuePath } from '@/utils/paths';

export default function InboxDetailHeader({
  projectKey,
  issueSeq,
  isMobile,
  onBack,
}: {
  projectKey: string;
  issueSeq: number;
  isMobile: boolean;
  onBack: () => void;
}) {
  const t = useTranslations('inbox');
  const tIssue = useTranslations('issue');
  const openLabel = tIssue('openAsPage');

  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b px-4 sm:px-6 xl:px-10">
      {isMobile && (
        <Button variant="ghost" size="sm" className="-ms-2 gap-1.5" onClick={onBack}>
          <ChevronLeft aria-hidden="true" className="size-4 rtl:rotate-180" />
          {t('backToList')}
        </Button>
      )}
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
        {projectKey}-{issueSeq}
      </span>
      <Button
        asChild
        variant="ghost"
        size="icon"
        className="size-9 text-muted-foreground hover:text-foreground sm:size-7"
      >
        <Link href={issuePath(projectKey, issueSeq)} title={openLabel} aria-label={openLabel}>
          <Maximize2 aria-hidden="true" />
        </Link>
      </Button>
    </div>
  );
}
