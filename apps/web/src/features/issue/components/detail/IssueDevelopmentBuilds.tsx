'use client';

import { useState } from 'react';
import { GitBranch } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { DevelopmentRepoBuilds } from '../../utils/groupDevelopmentLinks';
import { worstPipelineStatus, developmentLinkStatus } from '../../utils/groupDevelopmentLinks';
import IssueDevelopmentBuildRow from './IssueDevelopmentBuildRow';
import IssueDevelopmentCiBadge from './IssueDevelopmentCiBadge';

export default function IssueDevelopmentBuilds({
  issueId,
  buildsByRepo,
  canEdit,
  defaultOpen,
}: {
  issueId: number;
  buildsByRepo: DevelopmentRepoBuilds[];
  canEdit: boolean;
  defaultOpen: boolean;
}) {
  const t = useTranslations('issue.development');
  const [open, setOpen] = useState(defaultOpen);
  const builds = buildsByRepo.flatMap((group) => group.links);
  if (builds.length === 0) return null;
  const status = worstPipelineStatus(builds.map(developmentLinkStatus));

  return (
    <details
      className="rounded-md border"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs font-medium select-none [&::-webkit-details-marker]:hidden">
        <GitBranch className="size-3.5 text-muted-foreground" />
        <span>{t('builds')}</span>
        <span className="tabular-nums text-muted-foreground">
          {t('buildsCount', { count: builds.length })}
        </span>
        {status && (
          <span className="ms-auto">
            <IssueDevelopmentCiBadge status={status} />
          </span>
        )}
      </summary>
      <div className="border-t">
        {buildsByRepo.map((group) => (
          <div key={group.repository} className="border-b last:border-b-0">
            <p className="px-3 pt-2 font-mono text-[11px] text-muted-foreground" dir="ltr">
              {group.repository}
            </p>
            <div className="divide-y">
              {group.links.map((item) => (
                <IssueDevelopmentBuildRow
                  key={item.id}
                  issueId={issueId}
                  link={item}
                  canEdit={canEdit}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
