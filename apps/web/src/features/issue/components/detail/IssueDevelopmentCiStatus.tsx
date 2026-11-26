import { CircleCheck, CircleDashed, CircleX, LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { PipelineStatus } from '@/lib/api/endpoints/git';
import { cn } from '@/lib/utils';

const ICONS = {
  pending: CircleDashed,
  running: LoaderCircle,
  success: CircleCheck,
  failed: CircleX,
  canceled: CircleX,
  skipped: CircleDashed,
} satisfies Record<PipelineStatus, typeof CircleCheck>;

const COLORS = {
  pending: 'text-amber-600 dark:text-amber-400',
  running: 'text-sky-600 dark:text-sky-400',
  success: 'text-emerald-600 dark:text-emerald-400',
  failed: 'text-red-600 dark:text-red-400',
  canceled: 'text-red-600/80 dark:text-red-400/80',
  skipped: 'text-muted-foreground/70',
} satisfies Record<PipelineStatus, string>;

// A pipeline or check result as coloured text with its icon, linking to the run when
// the forge gave a URL.
export default function IssueDevelopmentCiStatus({
  status,
  url,
}: {
  status: PipelineStatus;
  url?: string | null;
}) {
  const t = useTranslations('issue.development');
  const Icon = ICONS[status];
  const content = (
    <>
      <Icon className={cn('size-3 shrink-0', status === 'running' && 'animate-spin')} />
      {t(`pipeline.${status}`)}
    </>
  );
  const className = cn('inline-flex items-center gap-1', COLORS[status]);
  return url ? (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      aria-label={t('openPipeline')}
      className={cn(className, 'hover:underline')}
    >
      {content}
    </a>
  ) : (
    <span className={className}>{content}</span>
  );
}
