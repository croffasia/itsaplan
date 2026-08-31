import { ExternalLink, GitBranch, GitPullRequest, Unlink } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { type DevelopmentLink } from '@/lib/api';
import IssueDevelopmentChecks from './IssueDevelopmentChecks';
import IssueDevelopmentCiBadge from './IssueDevelopmentCiBadge';
import IssueDevelopmentStateBadge from './IssueDevelopmentStateBadge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useRemoveIssueDevelopmentLink } from '@/services/issues.service';

const PROVIDER_LABEL: Record<DevelopmentLink['provider'], string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  gitea: 'Gitea',
  forgejo: 'Forgejo',
  bitbucket: 'Bitbucket',
};

export default function IssueDevelopmentLinkCard({
  issueId,
  link,
  canEdit,
}: {
  issueId: number;
  link: DevelopmentLink;
  canEdit: boolean;
}) {
  const t = useTranslations('issue.development');
  const format = useFormatter();
  const removeLink = useRemoveIssueDevelopmentLink(issueId);
  const ciStatus = link.checkStatus ?? link.pipelineStatus;
  const ciUrl = link.checkStatus ? null : link.pipelineUrl;

  return (
    <div className="rounded-md border px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {link.kind === 'branch' ? (
              <GitBranch className="size-3.5" />
            ) : (
              <GitPullRequest className="size-3.5" />
            )}
            <span>{PROVIDER_LABEL[link.provider]}</span>
            <span>·</span>
            <span className="truncate">
              {link.repository}
              {link.number == null ? '' : `#${link.number}`}
            </span>
          </div>
          {link.url ? (
            <a
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 flex items-center gap-1 text-sm font-medium hover:underline"
            >
              <span className="truncate" dir="auto">
                {link.title}
              </span>
              <ExternalLink className="size-3 shrink-0" />
            </a>
          ) : (
            <p className="mt-1 truncate text-sm font-medium" dir="auto">
              {link.title}
            </p>
          )}
          {link.kind === 'pull_request' && (link.sourceBranch || link.targetBranch) && (
            <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground" dir="ltr">
              {link.sourceBranch ?? '?'} → {link.targetBranch}
            </p>
          )}
          <time dateTime={link.updatedAt} className="mt-1 block text-[11px] text-muted-foreground">
            {t('updated', {
              date: format.dateTime(new Date(link.updatedAt), {
                dateStyle: 'medium',
                timeStyle: 'short',
              }),
            })}
          </time>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          <IssueDevelopmentStateBadge link={link} />
          {ciStatus && <IssueDevelopmentCiBadge status={ciStatus} url={ciUrl} />}
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
      <IssueDevelopmentChecks checks={link.checks} />
    </div>
  );
}
