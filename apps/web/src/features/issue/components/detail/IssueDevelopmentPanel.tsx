import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { DevelopmentLink } from '@/lib/api/endpoints/git';
import { usePersistedOpen } from '../../hooks/usePersistedOpen';
import { groupDevelopmentLinks } from '../../utils/groupDevelopmentLinks';
import IssueDevelopmentAddMenu from './IssueDevelopmentAddMenu';
import IssueDevelopmentBuilds from './IssueDevelopmentBuilds';
import IssueDevelopmentCreateDialog from './IssueDevelopmentCreateDialog';
import IssueDevelopmentLinkCard from './IssueDevelopmentLinkCard';
import IssueDevelopmentLinkDialog from './IssueDevelopmentLinkDialog';
import IssueSectionHeading from './IssueSectionHeading';

export default function IssueDevelopmentPanel({
  issueId,
  identifier,
  issueTitle,
  links,
  canEdit,
  canManage,
}: {
  issueId: number;
  identifier: string;
  issueTitle: string;
  links: DevelopmentLink[];
  canEdit: boolean;
  canManage: boolean;
}) {
  const t = useTranslations('issue.development');
  const { open, toggle } = usePersistedOpen('issue-development-open');
  const [linkOpen, setLinkOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const grouped = groupDevelopmentLinks(links);
  const work = [...grouped.pullRequests, ...grouped.workBranches];
  const tally =
    work.length === 0 && grouped.builds.length === 0
      ? undefined
      : grouped.builds.length === 0
        ? String(work.length)
        : work.length === 0
          ? t('buildsCount', { count: grouped.builds.length })
          : `${work.length} · ${t('buildsCount', { count: grouped.builds.length })}`;
  if (links.length === 0 && !canManage) return null;

  return (
    <div className={`mt-6 border-t pt-5 ${open ? '' : '-mb-2'}`}>
      <div className={`flex h-7 items-center justify-between gap-3 ${open ? 'mb-3' : ''}`}>
        <IssueSectionHeading label={t('title')} tally={tally} open={open} onToggle={toggle} />
        {canManage && (
          <IssueDevelopmentAddMenu
            onLink={() => setLinkOpen(true)}
            onCreate={() => setCreateOpen(true)}
          />
        )}
      </div>
      {open && (
        <div className="space-y-2">
          {links.length === 0 && (
            <button
              type="button"
              className="w-full rounded-md border border-dashed px-4 py-5 text-center text-sm text-muted-foreground hover:border-border hover:bg-muted/30 hover:text-foreground"
              onClick={() => setLinkOpen(true)}
            >
              {t('empty')}
            </button>
          )}
          {work.map((item) => (
            <IssueDevelopmentLinkCard
              key={item.id}
              issueId={issueId}
              link={item}
              canEdit={canEdit}
            />
          ))}
          <IssueDevelopmentBuilds
            issueId={issueId}
            buildsByRepo={grouped.buildsByRepo}
            canEdit={canEdit}
            defaultOpen={work.length === 0 && grouped.builds.length <= 3}
          />
        </div>
      )}
      <IssueDevelopmentLinkDialog issueId={issueId} open={linkOpen} onOpenChange={setLinkOpen} />
      <IssueDevelopmentCreateDialog
        issueId={issueId}
        identifier={identifier}
        issueTitle={issueTitle}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  );
}
