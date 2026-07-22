'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { colorDot } from '@/components/common/fields/colorDot';
import Modal from '@/components/common/overlay/Modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCreateIssueType, useUpdateIssueType } from '../../services/settings.service';
import type { PlannedIssueType } from '../../utils/issueTypesTransfer';
import { transferActionLabel } from '../../utils/transferAction';

// Confirms an issue types paste before applying it: lists each incoming type and
// whether it is created or updates an existing type's color. On confirm, new types are
// created and matched types have their color updated.
export default function IssueTypesImportDialog({
  projectKey,
  planned,
  onClose,
}: {
  projectKey: string;
  planned: PlannedIssueType[];
  onClose: () => void;
}) {
  const createIssueType = useCreateIssueType(projectKey);
  const updateIssueType = useUpdateIssueType(projectKey);
  const [busy, setBusy] = useState(false);

  const applicable = planned.filter((t) => t.action !== 'unchanged');

  async function apply() {
    setBusy(true);
    try {
      let created = 0;
      let updated = 0;
      for (const type of planned) {
        if (type.action === 'create') {
          await createIssueType.mutateAsync({
            name: type.name,
            icon: type.icon || undefined,
            color: type.color,
            isDefault: false,
          });
          created += 1;
        } else if (type.action === 'update' && type.existingId != null) {
          await updateIssueType.mutateAsync({ id: type.existingId, patch: { color: type.color } });
          updated += 1;
        }
      }
      toast.success(`Applied issue types: ${created} created, ${updated} updated.`);
      onClose();
    } catch {
      // The failed mutation is toasted by the global handler; keep the dialog open.
      setBusy(false);
    }
  }

  return (
    <Modal title="Apply issue types from clipboard" onClose={onClose} wide>
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          {applicable.length} issue type{applicable.length === 1 ? '' : 's'} will be applied. A
          matching type only has its color updated.
        </p>
        <div className="max-h-[50vh] divide-y divide-border/60 overflow-y-auto rounded-md border border-border/60">
          {planned.map((type) => (
            <div key={type.name} className="flex items-center gap-3 px-3 py-2.5">
              {colorDot(type.color)}
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{type.name}</span>
              <Badge
                variant={type.action === 'unchanged' ? 'outline' : 'secondary'}
                className="shrink-0 px-1.5 py-0 text-[10px] font-normal"
              >
                {transferActionLabel(type.action)}
              </Badge>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={busy || applicable.length === 0}>
            Apply {applicable.length > 0 ? applicable.length : ''} type
            {applicable.length === 1 ? '' : 's'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
