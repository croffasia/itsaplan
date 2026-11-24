import { useTranslations } from 'next-intl';
import type {
  CredentialCheck,
  IntegrationCredential,
  IntegrationMeta,
} from '@/lib/api/endpoints/integrations';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CredentialFormState } from '../../hooks/useCredentialForm';
import { CredentialCheckStatus } from './CredentialCheckStatus';
import { CredentialField } from './CredentialField';

function secretStatus(check: CredentialCheck | null): 'valid' | 'invalid' | undefined {
  if (check === 'valid') return 'valid';
  if (check === 'rejected' || check === 'unavailable') return 'invalid';
  return undefined;
}

// The fields of an integration's credential and its label, as the credential form fills them.
export function CredentialInputs({
  meta,
  existing,
  form,
}: {
  meta: IntegrationMeta;
  existing: IntegrationCredential | null;
  form: CredentialFormState;
}) {
  const t = useTranslations('teams.integrations');
  // The check's answer is shown on the first secret, the field it is usually about.
  const checkedField = meta.credentialSchema.find((f) => f.type === 'secret')?.key;

  return (
    <>
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
    </>
  );
}
