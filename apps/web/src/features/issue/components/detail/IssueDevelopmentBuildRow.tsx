'use client';

import { ExternalLink, GitBranch, Unlink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { DevelopmentLink } from '@/lib/api/endpoints/git';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useRemoveIssueDevelopmentLink } from '@/services/issues.service';
import { developmentLinkStatus } from '../../utils/groupDevelopmentLinks';
import IssueDevelopmentCiBadge from './IssueDevelopmentCiBadge';

export default function IssueDevelopmentBuildRow({
  issueId,
  link,
  canEdit,
}: {
  issueId: number;
  link: DevelopmentLink;
  canEdit: boolean;
}) {
  const t = useTranslations('issue.development');
  const removeLink = useRemoveIssueDevelopmentLink(issueId);
  const status = developmentLinkStatus(link);
  const sha = link.headSha?.slice(0, 7);
  const name = link.sourceBranch || link.title;

  return (
    <div className="flex min-h-8 items-center justify-between gap-3 px-3 py-1.5 text-xs">
      <div className="min-w-0">
        {link.url ? (
          <a
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="flex min-w-0 items-center gap-1 font-medium hover:underline"
          >
            <GitBranch className="size-3 shrink-0 text-muted-foreground" />
            <span className="truncate font-mono" dir="ltr">
              {name}
            </span>
            <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
          </a>
        ) : (
          <span className="flex min-w-0 items-center gap-1 font-medium">
            <GitBranch className="size-3 shrink-0 text-muted-foreground" />
            <span className="truncate font-mono" dir="ltr">
              {name}
            </span>
          </span>
        )}
        {sha && (
          <span className="ms-4 font-mono text-[10px] text-muted-foreground" dir="ltr">
            {sha}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {status && <IssueDevelopmentCiBadge status={status} url={link.pipelineUrl} />}
        {canEdit && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground hover:text-destructive"
                disabled={removeLink.isPending}
                onClick={() => removeLink.mutate(link.id)}
              >
                <Unlink className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('unlink')}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
