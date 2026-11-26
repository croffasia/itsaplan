import { useTranslations } from 'next-intl';
import type { GitConnectionProvider } from '@/lib/api/endpoints/git';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { GIT_PROVIDER_CONFIG } from '@/utils/gitProviderConfig';
import GitHostMark from './GitHostMark';

export default function GitHostPicker<P extends GitConnectionProvider>({
  id,
  hosts,
  value,
  onChange,
}: {
  id: string;
  hosts: readonly P[];
  value: P;
  onChange: (host: P) => void;
}) {
  const t = useTranslations('settings.git');
  return (
    <div className="space-y-2">
      <Label id={id}>{t('accountHost')}</Label>
      <div
        role="group"
        aria-labelledby={id}
        className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 sm:auto-cols-fr sm:grid-flow-col sm:grid-cols-none"
      >
        {hosts.map((host) => (
          <button
            key={host}
            type="button"
            aria-pressed={host === value}
            onClick={() => onChange(host)}
            className={cn(
              'flex h-8 items-center justify-center gap-2 rounded-md px-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              host === value
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <GitHostMark host={host} className="size-3.5 shrink-0" />
            {GIT_PROVIDER_CONFIG[host].label}
          </button>
        ))}
      </div>
    </div>
  );
}
