import { KeyRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { IntegrationMeta } from '@/lib/api/endpoints/integrations';
import { IntegrationIcon } from '@/components/common/IntegrationIcon';
import { cn } from '@/lib/utils';

// One kind of integration in the credential dialog's list. A row is marked when the
// team already holds a credential for it; a tool integration shows how many tools it
// offers.
export function CredentialRailSection({
  title,
  integrations,
  activeKey,
  connected,
  onSelect,
}: {
  title: string;
  integrations: IntegrationMeta[];
  activeKey: string;
  connected: Set<string>;
  onSelect: (integrationKey: string) => void;
}) {
  const t = useTranslations('teams.integrations');
  if (integrations.length === 0) return null;
  return (
    <div className="pb-1.5">
      <h3 className="sticky top-0 z-10 flex h-8 items-center gap-1.5 bg-card px-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
        <span className="font-normal tabular-nums">{integrations.length}</span>
      </h3>
      <div className="space-y-0.5">
        {integrations.map((integration) => {
          const active = integration.key === activeKey;
          return (
            <button
              key={integration.key}
              type="button"
              aria-current={active}
              onClick={() => onSelect(integration.key)}
              className={cn(
                'flex h-9 w-full items-center gap-2 rounded-md px-2 text-start text-sm transition-colors',
                active
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              )}
            >
              <IntegrationIcon
                integration={integration}
                className="size-6 rounded-md text-[10px]"
              />
              <span className="min-w-0 flex-1 truncate font-medium">{integration.label}</span>
              {connected.has(integration.key) && (
                <KeyRound role="img" aria-label={t('connected')} className="size-3.5 shrink-0" />
              )}
              {integration.tools.length > 0 && (
                <span className="text-xs tabular-nums">{integration.tools.length}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
