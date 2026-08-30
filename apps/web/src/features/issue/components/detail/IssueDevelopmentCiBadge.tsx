import { CircleCheck, CircleDashed, CircleX, LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type PipelineStatus } from '@/lib/api';
import { Badge } from '@/components/ui/badge';

export default function IssueDevelopmentCiBadge({
  status,
  url,
}: {
  status: PipelineStatus;
  url?: string | null;
}) {
  const t = useTranslations('issue.development');
  const Icon =
    status === 'success'
      ? CircleCheck
      : status === 'failed' || status === 'canceled'
        ? CircleX
        : status === 'running'
          ? LoaderCircle
          : CircleDashed;
  const className =
    status === 'success'
      ? 'text-emerald-600 dark:text-emerald-400'
      : status === 'failed'
        ? 'text-destructive'
        : 'text-muted-foreground';
  const badge = (
    <Badge variant="outline" className={className}>
      <Icon className={status === 'running' ? 'animate-spin' : undefined} />
      {t(`pipeline.${status}`)}
    </Badge>
  );
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" aria-label={t('openPipeline')}>
      {badge}
    </a>
  ) : (
    badge
  );
}
