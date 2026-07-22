import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { ConfigField, IntegrationCredential, IntegrationMeta } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useCreateCredential, useUpdateCredential } from '@/services/integrations.service';
import { IntegrationIcon } from './IntegrationIcon';

type FieldValue = string | boolean;

const INPUT_TYPES: Partial<Record<ConfigField['type'], string>> = {
  secret: 'password',
  number: 'number',
};

// Seeds the form state for an integration's fields. On edit, non-secret fields are
// prefilled from the credential's redacted view; secret fields start empty (a blank
// keeps the stored one).
function seedValues(
  meta: IntegrationMeta,
  existing: IntegrationCredential | null,
): Record<string, FieldValue> {
  const out: Record<string, FieldValue> = {};
  for (const field of meta.credentialSchema) {
    if (field.type === 'boolean') {
      out[field.key] = existing ? existing.redacted[field.key] === true : false;
    } else if (field.type === 'secret') {
      out[field.key] = '';
    } else {
      const stored = existing?.redacted[field.key];
      out[field.key] = stored == null ? '' : String(stored);
    }
  }
  return out;
}

// Step two of adding a credential (and the whole flow on edit): the credential form for
// a chosen integration, built from its credentialSchema. Secret fields left blank on
// edit keep their stored value. `onBack` returns to the picker (create only).
export function CredentialForm({
  projectKey,
  meta,
  existing,
  onBack,
  onDone,
}: {
  projectKey: string;
  meta: IntegrationMeta;
  existing: IntegrationCredential | null;
  onBack?: () => void;
  onDone: () => void;
}) {
  const isEdit = existing != null;
  const [label, setLabel] = useState(existing?.label ?? '');
  const [values, setValues] = useState<Record<string, FieldValue>>(() =>
    seedValues(meta, existing),
  );
  const [busy, setBusy] = useState(false);

  const create = useCreateCredential(projectKey);
  const update = useUpdateCredential(projectKey);

  function setField(key: string, v: FieldValue) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function fieldSatisfied(field: ConfigField): boolean {
    if (!field.required || field.type === 'boolean') return true;
    const v = values[field.key];
    if (typeof v === 'string' && v.trim() !== '') return true;
    if (isEdit) {
      const stored = existing?.redacted[field.key];
      return stored != null && String(stored) !== '';
    }
    return false;
  }

  const canSubmit = !busy && meta.credentialSchema.every(fieldSatisfied);

  function buildCredential(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const field of meta.credentialSchema) {
      const v = values[field.key];
      if (field.type === 'boolean') out[field.key] = v === true;
      else if (typeof v === 'string' && v.trim() !== '') out[field.key] = v.trim();
    }
    return out;
  }

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      if (isEdit) {
        await update.mutateAsync({
          id: existing.id,
          patch: { label: label.trim() || null, credential: buildCredential() },
        });
      } else {
        await create.mutateAsync({
          integrationKey: meta.key,
          label: label.trim() || null,
          credential: buildCredential(),
        });
      }
      onDone();
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={onBack}
            aria-label="Back to integrations"
          >
            <ChevronLeft className="size-4" />
          </Button>
        )}
        <IntegrationIcon integration={meta} className="size-8" />
        <span className="text-sm font-medium text-foreground">{meta.label}</span>
      </div>

      {meta.credentialSchema.map((field) => (
        <div key={field.key} className="space-y-1.5">
          {field.type === 'boolean' ? (
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={values[field.key] === true}
                onCheckedChange={(v) => setField(field.key, v === true)}
              />
              <span className="text-sm">{field.label}</span>
            </label>
          ) : (
            <>
              <Label>
                {field.label}
                {!field.required && <span className="text-muted-foreground"> (optional)</span>}
              </Label>
              <Input
                type={INPUT_TYPES[field.type] ?? 'text'}
                autoComplete="off"
                value={typeof values[field.key] === 'string' ? (values[field.key] as string) : ''}
                onChange={(e) => setField(field.key, e.target.value)}
                placeholder={
                  isEdit && field.type === 'secret'
                    ? `Leave blank to keep ${existing?.redacted[field.key] ?? '••••'}`
                    : field.placeholder
                }
              />
            </>
          )}
          {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
        </div>
      ))}

      <div className="space-y-1.5">
        <Label>Label (optional)</Label>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Team account"
        />
        <p className="text-xs text-muted-foreground">
          Helps tell apart credentials of the same integration. Secrets are stored encrypted.
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!canSubmit}>
          {isEdit ? 'Save' : 'Add credential'}
        </Button>
      </div>
    </div>
  );
}
