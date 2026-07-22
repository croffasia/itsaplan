'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { IssueType } from '@/lib/api';
import Modal from '@/components/common/overlay/Modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCreateCustomField, useCreateIssueType } from '../../services/settings.service';
import { FIELD_TYPE_LABELS } from './SettingsCustomFieldForm';
import type { CustomFieldsImportPlan } from '../../utils/customFieldsTransfer';

// Confirms a custom fields paste before applying it. Lists any issue types that will be
// created for scoped fields and each field with its target scope and whether it is new
// or skipped (a same-name field already exists there). On confirm, missing types are
// created first, then the fields.
export default function CustomFieldsImportDialog({
  projectKey,
  plan,
  existingTypes,
  onClose,
}: {
  projectKey: string;
  plan: CustomFieldsImportPlan;
  existingTypes: IssueType[];
  onClose: () => void;
}) {
  const createIssueType = useCreateIssueType(projectKey);
  const createCustomField = useCreateCustomField(projectKey);
  const [busy, setBusy] = useState(false);

  const toCreate = plan.fields.filter((f) => f.action === 'create');

  async function apply() {
    setBusy(true);
    try {
      const typeIdByName = new Map<string, number>(
        existingTypes.map((t) => [t.name.toLowerCase(), t.id]),
      );
      for (const name of plan.newTypeNames) {
        const row = (await createIssueType.mutateAsync({ name })) as IssueType;
        typeIdByName.set(name.toLowerCase(), row.id);
      }
      for (const field of toCreate) {
        const issueTypeId = field.type
          ? (typeIdByName.get(field.type.toLowerCase()) ?? null)
          : null;
        await createCustomField.mutateAsync({
          issueTypeId,
          name: field.name,
          fieldType: field.fieldType,
          showInBody: field.showInBody,
          options: field.options,
        });
      }
      toast.success(
        `Applied custom fields: ${toCreate.length} created` +
          (plan.newTypeNames.length ? `, ${plan.newTypeNames.length} issue type(s) added` : ''),
      );
      onClose();
    } catch {
      // The failed mutation is toasted by the global handler; keep the dialog open.
      setBusy(false);
    }
  }

  return (
    <Modal title="Apply custom fields from clipboard" onClose={onClose} wide>
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          {toCreate.length} field{toCreate.length === 1 ? '' : 's'} will be added
          {plan.newTypeNames.length > 0
            ? `, and ${plan.newTypeNames.length} new issue type${plan.newTypeNames.length === 1 ? '' : 's'} created: ${plan.newTypeNames.join(', ')}.`
            : '.'}
        </p>
        <div className="max-h-[50vh] divide-y divide-border/60 overflow-y-auto rounded-md border border-border/60">
          {plan.fields.map((field) => (
            <div
              key={`${field.type ?? 'global'}:${field.name}`}
              className="flex items-center gap-3 px-3 py-2.5"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{field.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {FIELD_TYPE_LABELS[field.fieldType]}
              </span>
              <span className="w-28 shrink-0 truncate text-right text-xs text-muted-foreground">
                {field.type ?? 'Global'}
              </span>
              <Badge
                variant={field.action === 'skip' ? 'outline' : 'secondary'}
                className="w-14 shrink-0 justify-center px-1.5 py-0 text-[10px] font-normal"
              >
                {field.action === 'create' ? 'New' : 'Exists'}
              </Badge>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={busy || toCreate.length === 0}>
            Apply {toCreate.length > 0 ? toCreate.length : ''} field
            {toCreate.length === 1 ? '' : 's'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
