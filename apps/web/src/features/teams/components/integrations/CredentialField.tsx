import { useTranslations } from 'next-intl';
import type { ConfigField, IntegrationCredential } from '@/lib/api/endpoints/integrations';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SecretInput from '@/components/common/inputs/SecretInput';
import type { CredentialFieldValue } from '../../hooks/useCredentialForm';
import { CredentialFieldHelp } from './CredentialFieldHelp';

const INPUT_TYPES: Partial<Record<ConfigField['type'], string>> = {
  number: 'number',
};

export function CredentialField({
  field,
  value,
  existing,
  status,
  onChange,
}: {
  field: ConfigField;
  value: CredentialFieldValue | undefined;
  existing: IntegrationCredential | null;
  // The check's answer, on the field it is about.
  status?: 'valid' | 'invalid';
  onChange: (value: CredentialFieldValue) => void;
}) {
  const t = useTranslations('teams.integrations');
  const id = `credential-${field.key}`;
  const help = field.help && <CredentialFieldHelp field={field.label} help={field.help} />;

  if (field.type === 'boolean') {
    return (
      <div className="flex items-center gap-1.5">
        <label className="flex cursor-pointer items-center gap-2">
          <Checkbox checked={value === true} onCheckedChange={(v) => onChange(v === true)} />
          <span className="text-sm">{field.label}</span>
        </label>
        {help}
      </div>
    );
  }

  const text = typeof value === 'string' ? value : '';
  return (
    <>
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id}>
          {field.label}
          {!field.required && <span className="text-muted-foreground">{t('optionalMark')}</span>}
        </Label>
        {help}
      </div>
      {field.type === 'secret' ? (
        <SecretInput
          id={id}
          value={text}
          onChange={onChange}
          // The redacted value tells which stored secret a blank field keeps.
          hasStored={false}
          status={status}
          placeholder={
            existing
              ? t('keepStored', { value: String(existing.redacted[field.key] ?? '••••') })
              : field.placeholder
          }
        />
      ) : (
        <Input
          id={id}
          type={INPUT_TYPES[field.type] ?? 'text'}
          autoComplete="off"
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
      )}
    </>
  );
}
