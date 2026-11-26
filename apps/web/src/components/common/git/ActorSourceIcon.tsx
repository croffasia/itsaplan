import { useTranslations } from 'next-intl';
import type { GitConnectionProvider } from '@/lib/api/endpoints/git';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { GIT_PROVIDER_CONFIG } from '@/utils/gitProviderConfig';
import GitHostMark from './GitHostMark';

// Shown after the name of an account on a repository host, such as the author of a
// synced comment. The tooltip names the host.
export default function ActorSourceIcon({
  source,
  className,
}: {
  source: GitConnectionProvider;
  className?: string;
}) {
  const t = useTranslations('common');
  const label = t('fromHost', { host: GIT_PROVIDER_CONFIG[source].label });
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <GitHostMark
          host={source}
          role="img"
          aria-label={label}
          className={cn('size-3 shrink-0 text-muted-foreground', className)}
        />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
