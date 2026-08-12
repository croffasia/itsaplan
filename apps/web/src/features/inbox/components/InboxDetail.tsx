'use client';

import { ChevronLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectDetail } from '@/lib/api';
import { Button } from '@/components/ui/button';
import IssueDetailContent from '@/features/issue/components/detail/IssueDetailContent';

// The issue of the selected notification. On a narrow screen it takes the whole
// inbox and returns to the list through the back button; on a wide one it is the
// right pane next to the list.
export default function InboxDetail({
  project,
  issueId,
  isMobile,
  onBack,
  onDeleted,
}: {
  project: ProjectDetail;
  issueId: number;
  isMobile: boolean;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const t = useTranslations('inbox');

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {isMobile && (
        <div className="flex h-11 shrink-0 items-center border-b px-2">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={onBack}>
            <ChevronLeft className="size-4" />
            {t('backToList')}
          </Button>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 xl:px-10">
        <IssueDetailContent
          project={project}
          issueId={issueId}
          layout={isMobile ? 'panel' : 'split'}
          onDeleted={onDeleted}
        />
      </div>
    </div>
  );
}
