import { useState } from 'react';
import type {
  ConfigField,
  CredentialCheck,
  IntegrationCredential,
  IntegrationMeta,
} from '@/lib/api/endpoints/integrations';
import {
  useCheckCredential,
  useCreateCredential,
  useUpdateCredential,
} from '@/services/integrations.service';

export type CredentialFieldValue = string | boolean;

interface Draft {
  values: Record<string, CredentialFieldValue>;
  label: string;
  // What the service said about the values as they are now; null until they are checked.
  check: CredentialCheck | null;
}

// Seeds the form state for an integration's fields. On edit, non-secret fields are
// prefilled from the credential's redacted view; secret fields start empty (a blank
// keeps the stored one).
function seedValues(
  meta: IntegrationMeta,
  existing: IntegrationCredential | null,
): Record<string, CredentialFieldValue> {
  const out: Record<string, CredentialFieldValue> = {};
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

// The credential form of the integration `meta`, built from its credentialSchema.
// Each integration keeps its own draft, so picking another one in the catalog and
// coming back keeps what was typed. A credential is validated with its service before it
// can be saved, on edit too. A refusal, or a service that gave no answer, keeps it from
// being saved; one that cannot be checked from here does not.
// Secret fields left blank on edit keep their stored value, and are checked with it. `onDone` gets the new
// credential on create.
export function useCredentialForm(
  teamId: number,
  meta: IntegrationMeta | undefined,
  existing: IntegrationCredential | null,
  onDone: (created?: IntegrationCredential) => void,
) {
  const isEdit = existing != null;
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState(false);
  const create = useCreateCredential(teamId);
  const update = useUpdateCredential(teamId);
  const checkCredential = useCheckCredential(teamId);

  const draft: Draft | null = meta
    ? (drafts[meta.key] ?? {
        values: seedValues(meta, existing),
        label: existing?.label ?? '',
        check: null,
      })
    : null;
  const values = draft?.values ?? {};

  function change(key: string, patch: Partial<Draft>) {
    if (!draft) return;
    setDrafts((prev) => ({ ...prev, [key]: { ...(prev[key] ?? draft), ...patch } }));
  }

  function fieldSatisfied(field: ConfigField): boolean {
    if (!field.required || field.type === 'boolean') return true;
    const v = values[field.key];
    if (typeof v === 'string' && v.trim() !== '') return true;
    if (isEdit) {
      const stored = existing.redacted[field.key];
      return stored != null && String(stored) !== '';
    }
    return false;
  }

  const filled = !!meta && meta.credentialSchema.every(fieldSatisfied);
  const checking = checkCredential.isPending;
  const passed = draft?.check === 'valid' || draft?.check === 'unknown';
  const canCheck = filled && !busy && !checking;
  const canSubmit = filled && !busy && !checking && passed;

  function buildCredential(schema: ConfigField[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const field of schema) {
      const v = values[field.key];
      if (field.type === 'boolean') out[field.key] = v === true;
      else if (typeof v === 'string' && v.trim() !== '') out[field.key] = v.trim();
    }
    return out;
  }

  async function validate() {
    if (!canCheck || !meta || !draft) return;
    const key = meta.key;
    const checked = draft.values;
    try {
      const result = await checkCredential.mutateAsync({
        integrationKey: key,
        credentialId: existing?.id ?? null,
        credential: buildCredential(meta.credentialSchema),
      });
      // An answer about values edited while it was on its way says nothing about them.
      setDrafts((prev) => {
        const current = prev[key] ?? draft;
        return current.values === checked
          ? { ...prev, [key]: { ...current, check: result } }
          : prev;
      });
    } catch {
      // The mutation cache has shown the error.
    }
  }

  async function submit() {
    if (!canSubmit || !meta || !draft) return;
    setBusy(true);
    const label = draft.label.trim() || null;
    const credential = buildCredential(meta.credentialSchema);
    try {
      if (isEdit) {
        await update.mutateAsync({ id: existing.id, patch: { label, credential } });
        onDone();
      } else {
        onDone(await create.mutateAsync({ integrationKey: meta.key, label, credential }));
      }
    } catch {
      setBusy(false);
    }
  }

  return {
    isEdit,
    values,
    label: draft?.label ?? '',
    busy,
    checking,
    check: draft?.check ?? null,
    // Not yet accepted by a validation: the main button validates instead of saving.
    needsValidation: !passed,
    canCheck,
    canSubmit,
    setField: (key: string, value: CredentialFieldValue) => {
      if (meta) change(meta.key, { values: { ...values, [key]: value }, check: null });
    },
    setLabel: (label: string) => {
      if (meta) change(meta.key, { label });
    },
    validate,
    submit,
  };
}

export type CredentialFormState = ReturnType<typeof useCredentialForm>;
