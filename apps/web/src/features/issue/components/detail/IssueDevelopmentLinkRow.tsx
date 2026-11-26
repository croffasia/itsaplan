import { Unlink } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { DevelopmentLink } from '@/lib/api/endpoints/git';
import { calendarSystem } from '@/utils/dates';
import { developmentLinkState } from '../../utils/development';
import IssueDevelopmentChecks from './IssueDevelopmentChecks';
import IssueDevelopmentCiStatus from './IssueDevelopmentCiStatus';
import IssueDevelopmentStateIcon from './IssueDevelopmentStateIcon';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useRemoveIssueDevelopmentLink } from '@/services/issues.service';

// One linked branch or pull request: an icon coloured by its state, the title, and
// one line with the repository, the state and the checks. The branches it merges
// and when it last changed are in the title's hover text.
export default function IssueDevelopmentLinkRow({
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
  const state = developmentLinkState(link);
  const ciStatus = link.checkStatus ?? link.pipelineStatus;
  const ciUrl = link.checkStatus ? null : link.pipelineUrl;
  const branches =
    link.kind === 'pull_request' && (link.sourceBranch || link.targetBranch)
      ? `${link.sourceBranch ?? '?'} → ${link.targetBranch}`
      : null;
  const updated = t('updated', {
    date: format.dateTime(new Date(link.updatedAt), {
      dateStyle: 'medium',
      timeStyle: 'short',
      calendar: calendarSystem(),
    }),
  });
  const hint = [branches, updated].filter(Boolean).join('\n');

  return (
    <div className="group flex items-start gap-2.5 rounded-md px-2 py-2 hover:bg-accent/50">
      <IssueDevelopmentStateIcon state={state} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        {link.url ? (
          <a
            href={link.url}
            target="_blank"
            rel="noreferrer"
            title={hint}
            dir="auto"
            className="block truncate text-sm hover:underline"
          >
            {link.title}
          </a>
        ) : (
          <p title={hint} dir="auto" className="truncate text-sm">
            {link.title}
          </p>
        )}
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground/70">
          <span dir="ltr" className="truncate">
            {link.repository}
            {link.number == null ? '' : `#${link.number}`}
          </span>
          <span aria-hidden="true">·</span>
          <span>{t(state)}</span>
          {ciStatus && (
            <>
              <span aria-hidden="true">·</span>
              <IssueDevelopmentCiStatus status={ciStatus} url={ciUrl} />
            </>
          )}
        </p>
        <IssueDevelopmentChecks checks={link.checks} />
      </div>
      {canEdit && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className="shrink-0 text-muted-foreground/70 opacity-0 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100 max-sm:opacity-100"
              aria-label={t('unlink')}
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
  );
}
