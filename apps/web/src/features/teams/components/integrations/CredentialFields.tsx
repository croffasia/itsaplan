import { KeyRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type {
  CredentialCheck,
  IntegrationCredential,
  IntegrationMeta,
} from '@/lib/api/endpoints/integrations';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IntegrationIcon } from '@/components/common/IntegrationIcon';
import { cn } from '@/lib/utils';
import type { CredentialFormState } from '../../hooks/useCredentialForm';
import { toolIntegrations } from '../../utils/toolCatalog';
import { CredentialCheckStatus } from './CredentialCheckStatus';
import { CredentialField } from './CredentialField';
import { IntegrationWebsiteLink } from '../IntegrationWebsiteLink';

function secretStatus(check: CredentialCheck | null): 'valid' | 'invalid' | undefined {
  if (check === 'valid') return 'valid';
  if (check === 'rejected' || check === 'unavailable') return 'invalid';
  return undefined;
}

// The credential form of one integration: what it is, its fields and the label. A tool
// integration also lists the tools agents get with the credential.
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
  // The check's answer is shown on the first secret, the field it is usually about.
  const checkedField = meta.credentialSchema.find((f) => f.type === 'secret')?.key;

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center gap-3.5">
        <IntegrationIcon integration={meta} className="size-11 rounded-xl text-sm" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-foreground">{meta.label}</h3>
          <p className="text-sm text-muted-foreground">{t(`groups.${meta.kind}.hint`)}</p>
        </div>
        {meta.website && <IntegrationWebsiteLink integration={meta.label} href={meta.website} />}
      </div>

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
        {meta.credentialSchema.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <CredentialField
              field={field}
              value={form.values[field.key]}
              existing={existing}
              status={field.key === checkedField ? secretStatus(form.check) : undefined}
              onChange={(value) => form.setField(field.key, value)}
            />
            {field.key === checkedField && (
              <CredentialCheckStatus check={form.check} integration={meta.label} />
            )}
          </div>
        ))}

        <div className="space-y-1.5">
          <Label htmlFor="credential-label">{t('label')}</Label>
          <Input
            id="credential-label"
            autoComplete="off"
            value={form.label}
            onChange={(e) => form.setLabel(e.target.value)}
            placeholder={t('labelPlaceholder')}
          />
          <p className="text-xs text-muted-foreground">{t('labelHint')}</p>
        </div>

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
