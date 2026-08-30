import { CircleCheck, CircleDashed, CircleX, LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type PipelineStatus } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { issueDevelopmentBadgeClassName } from './issueDevelopmentBadgeStyles';

const iconByStatus = {
  pending: CircleDashed,
  running: LoaderCircle,
  success: CircleCheck,
  failed: CircleX,
  canceled: CircleX,
  skipped: CircleDashed,
} satisfies Record<PipelineStatus, typeof CircleCheck>;

const classNameByStatus = {
  pending: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  running: 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  failed: 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300',
  canceled: 'border-red-500/20 bg-red-500/5 text-red-700 dark:text-red-300',
  skipped: 'border-border/70 bg-muted/50 text-muted-foreground',
} satisfies Record<PipelineStatus, string>;

export default function IssueDevelopmentCiBadge({
  status,
  url,
}: {
  status: PipelineStatus;
  url?: string | null;
}) {
  const t = useTranslations('issue.development');
  const Icon = iconByStatus[status];
  const className = `${issueDevelopmentBadgeClassName} ${classNameByStatus[status]}`;
  const badge = (
    <Badge variant="outline" className={className}>
      <Icon className={status === 'running' ? 'animate-spin' : undefined} />
      {t(`pipeline.${status}`)}
    </Badge>
  );
  return url ? (
    <Badge
      asChild
      variant="outline"
      className={`${className} cursor-pointer transition-[color,background-color,border-color,box-shadow,filter] hover:brightness-95 dark:hover:brightness-110`}
    >
      <a href={url} target="_blank" rel="noreferrer" aria-label={t('openPipeline')}>
        <Icon className={status === 'running' ? 'animate-spin' : undefined} />
        {t(`pipeline.${status}`)}
      </a>
    </Badge>
  ) : (
    badge
  );
}
