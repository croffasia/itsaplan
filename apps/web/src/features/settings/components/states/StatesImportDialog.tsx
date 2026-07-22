'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { colorDot } from '@/components/common/fields/colorDot';
import Modal from '@/components/common/overlay/Modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCreateColumn, useUpdateColumn } from '../../services/settings.service';
import type { PlannedState } from '../../utils/statesTransfer';
import { transferActionLabel } from '../../utils/transferAction';

// Confirms a states paste before applying it: lists each incoming state, its group,
// and whether it is created or updates an existing state's color. On confirm, new
// states are created and matched states have their color updated.
export default function StatesImportDialog({
  projectKey,
  planned,
  onClose,
}: {
  projectKey: string;
  planned: PlannedState[];
  onClose: () => void;
}) {
  const createColumn = useCreateColumn(projectKey);
  const updateColumn = useUpdateColumn(projectKey);
  const [busy, setBusy] = useState(false);

  const applicable = planned.filter((s) => s.action !== 'unchanged');

  async function apply() {
    setBusy(true);
    try {
      let created = 0;
      let updated = 0;
      for (const state of planned) {
        if (state.action === 'create') {
          await createColumn.mutateAsync({
            name: state.name,
            stateType: state.stateType,
            color: state.color,
          });
          created += 1;
        } else if (state.action === 'update' && state.existingId != null) {
          await updateColumn.mutateAsync({ id: state.existingId, patch: { color: state.color } });
          updated += 1;
        }
      }
      toast.success(`Applied states: ${created} created, ${updated} updated.`);
      onClose();
    } catch {
      // The failed mutation is toasted by the global handler; keep the dialog open.
      setBusy(false);
    }
  }

  return (
    <Modal title="Apply states from clipboard" onClose={onClose} wide>
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          {applicable.length} state{applicable.length === 1 ? '' : 's'} will be applied. A matching
          state keeps its group; only its color is updated.
        </p>
        <div className="max-h-[50vh] divide-y divide-border/60 overflow-y-auto rounded-md border border-border/60">
          {planned.map((state) => (
            <div
              key={`${state.stateType}:${state.name}`}
              className="flex items-center gap-3 px-3 py-2.5"
            >
              {colorDot(state.color)}
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{state.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground capitalize">
                {state.stateType}
              </span>
              <Badge
                variant={state.action === 'unchanged' ? 'outline' : 'secondary'}
                className="shrink-0 px-1.5 py-0 text-[10px] font-normal"
              >
                {transferActionLabel(state.action)}
              </Badge>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={busy || applicable.length === 0}>
            Apply {applicable.length > 0 ? applicable.length : ''} state
            {applicable.length === 1 ? '' : 's'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
