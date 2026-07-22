'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { LabelGroup } from '@/lib/api';
import { colorDot } from '@/components/common/fields/colorDot';
import Modal from '@/components/common/overlay/Modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  useCreateLabel,
  useCreateLabelGroup,
  useUpdateLabel,
  useUpdateLabelGroup,
} from '../../services/settings.service';
import type { LabelsImportPlan, PlannedGroup, PlannedLabel } from '../../utils/labelsTransfer';
import { transferActionLabel } from '../../utils/transferAction';

function ItemRow({
  color,
  name,
  meta,
  action,
}: {
  color: string;
  name: string;
  meta?: string;
  action: 'create' | 'update' | 'unchanged';
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      {colorDot(color)}
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
      {meta && <span className="shrink-0 text-xs text-muted-foreground">{meta}</span>}
      <Badge
        variant={action === 'unchanged' ? 'outline' : 'secondary'}
        className="shrink-0 px-1.5 py-0 text-[10px] font-normal"
      >
        {transferActionLabel(action)}
      </Badge>
    </div>
  );
}

// Confirms a labels paste before applying it: lists the incoming groups and labels and
// whether each is created or recolored. On confirm, groups are applied first (so new
// labels can be placed in their group), then labels. A matched label keeps its group.
export default function LabelsImportDialog({
  projectKey,
  plan,
  existingGroups,
  onClose,
}: {
  projectKey: string;
  plan: LabelsImportPlan;
  existingGroups: LabelGroup[];
  onClose: () => void;
}) {
  const createGroup = useCreateLabelGroup(projectKey);
  const updateGroup = useUpdateLabelGroup(projectKey);
  const createLabel = useCreateLabel(projectKey);
  const updateLabel = useUpdateLabel(projectKey);
  const [busy, setBusy] = useState(false);

  const changed = (items: (PlannedGroup | PlannedLabel)[]) =>
    items.filter((i) => i.action !== 'unchanged');
  const applicable = changed(plan.groups).length + changed(plan.labels).length;

  async function apply() {
    setBusy(true);
    try {
      // Resolve a group name to an id: seed with existing groups, then add created ones.
      const groupIdByName = new Map<string, number>(
        existingGroups.map((g) => [g.name.toLowerCase(), g.id]),
      );
      let created = 0;
      let updated = 0;

      for (const group of plan.groups) {
        if (group.action === 'create') {
          const row = (await createGroup.mutateAsync({
            name: group.name,
            color: group.color,
          })) as LabelGroup;
          groupIdByName.set(group.name.toLowerCase(), row.id);
          created += 1;
        } else if (group.action === 'update' && group.existingId != null) {
          await updateGroup.mutateAsync({ id: group.existingId, patch: { color: group.color } });
          updated += 1;
        }
      }

      for (const label of plan.labels) {
        if (label.action === 'create') {
          const groupId = label.group
            ? (groupIdByName.get(label.group.toLowerCase()) ?? null)
            : null;
          await createLabel.mutateAsync({ name: label.name, color: label.color, groupId });
          created += 1;
        } else if (label.action === 'update' && label.existingId != null) {
          await updateLabel.mutateAsync({ id: label.existingId, patch: { color: label.color } });
          updated += 1;
        }
      }

      toast.success(`Applied labels: ${created} created, ${updated} updated.`);
      onClose();
    } catch {
      // The failed mutation is toasted by the global handler; keep the dialog open.
      setBusy(false);
    }
  }

  return (
    <Modal title="Apply labels from clipboard" onClose={onClose} wide>
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          {applicable} item{applicable === 1 ? '' : 's'} will be applied. A matching label keeps its
          group; only its color is updated.
        </p>

        {plan.groups.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Groups
            </p>
            <div className="divide-y divide-border/60 overflow-hidden rounded-md border border-border/60">
              {plan.groups.map((g) => (
                <ItemRow key={g.name} color={g.color} name={g.name} action={g.action} />
              ))}
            </div>
          </div>
        )}

        {plan.labels.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Labels
            </p>
            <div className="max-h-[40vh] divide-y divide-border/60 overflow-y-auto rounded-md border border-border/60">
              {plan.labels.map((l) => (
                <ItemRow
                  key={l.name}
                  color={l.color}
                  name={l.name}
                  meta={l.group ?? 'Ungrouped'}
                  action={l.action}
                />
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={busy || applicable === 0}>
            Apply {applicable > 0 ? applicable : ''} item{applicable === 1 ? '' : 's'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
