import { useTranslations } from 'next-intl';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { GIT_CONNECTION_PROVIDERS, GIT_PROVIDER_CONFIG } from '@/utils/gitProviderConfig';
import { actorSourceIcons } from '@/cloud';
import GitHostMark from './GitHostMark';

// Shown after the name of someone without an account here: an account on a repository
// host, such as the author of a synced comment, or an author from a source an edition adds.
// The tooltip names where they wrote. A source with no icon shows nothing.
export default function ActorSourceIcon({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  const t = useTranslations('common');
  const host = GIT_CONNECTION_PROVIDERS.find((one) => one === source);
  const Icon = actorSourceIcons[source];
  const key = `actorSource.${source}` as Parameters<typeof t.has>[0];
  let label = source;
  if (host) label = t('fromHost', { host: GIT_PROVIDER_CONFIG[host].label });
  else if (t.has(key)) label = t(key);
  const props = {
    role: 'img',
    'aria-label': label,
    className: cn('size-3 shrink-0 text-muted-foreground', className),
  };
  const mark = host ? <GitHostMark host={host} {...props} /> : Icon && <Icon {...props} />;
  if (!mark) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{mark}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
