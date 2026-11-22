import { KeyRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { IntegrationCredential, IntegrationMeta } from '@/lib/api/endpoints/integrations';
import { Badge } from '@/components/ui/badge';
import { IntegrationIcon } from '@/components/common/IntegrationIcon';
import { cn } from '@/lib/utils';
import type { CredentialFormState } from '../../hooks/useCredentialForm';
import { toolIntegrations } from '../../utils/toolCatalog';
import { CredentialInputs } from './CredentialInputs';
import { IntegrationWebsiteLink } from '../IntegrationWebsiteLink';
import { ToolLockedNotice } from '../ToolLockedNotice';

// The credential form of one integration: what it is, its fields and the label. A tool
// integration also lists the tools agents get with the credential. One that comes with
// another edition shows what it is and its tools, and no form.
export function CredentialFields({
  meta,
  existing,
  form,
  connected,
  className,
}: {
  meta: IntegrationMeta;
  existing: IntegrationCredential | null;
  form: CredentialFormState;
  // The team already holds a credential for it, so a new one is a second account.
  connected: boolean;
  className?: string;
}) {
  const t = useTranslations('teams.integrations');
  const tools = toolIntegrations([meta])[0]?.tools ?? [];

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center gap-3.5">
        <IntegrationIcon integration={meta} className="size-11 rounded-xl text-sm" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-foreground">{meta.label}</h3>
          <p className="text-sm text-muted-foreground">
            {meta.description ?? t(`groups.${meta.kind}.hint`)}
          </p>
        </div>
        {meta.website && <IntegrationWebsiteLink integration={meta.label} href={meta.website} />}
      </div>

      {meta.locked && <ToolLockedNotice integration={meta.label} />}

      {connected && (
        <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3.5 py-3">
          <KeyRound className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {t('alreadyConnected', { integration: meta.label })}
            </p>
            <p className="text-xs text-muted-foreground">{t('alreadyConnectedHint')}</p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {!meta.locked && <CredentialInputs meta={meta} existing={existing} form={form} />}

        {tools.length > 0 && (
          <div className="space-y-2.5 border-t pt-5">
            <h4 className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              {t('agentTools')}
              <span className="font-normal tabular-nums">{tools.length}</span>
            </h4>
            <div className="flex flex-wrap gap-1">
              {tools.map((tool) => (
                <Badge key={tool.toolKey} variant="secondary" className="font-normal">
                  {tool.name}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
