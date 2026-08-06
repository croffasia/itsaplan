import { useState } from 'react';
import { toast } from 'sonner';
import { ApiError, type Cycle } from '@/lib/api';
import { formatShortDate } from '@/utils/dates';
import Modal from '@/components/common/overlay/Modal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePlannedCyclesQuery, useTransferCycleIssues } from '@/services/cycles.service';

// Moves the cycle's unfinished issues elsewhere. The target is another cycle the
// project has not finished yet, or "No cycle", which leaves them unplanned. Finished
// issues stay on this cycle, so it keeps recording what it delivered.
const NO_CYCLE = 'none';

export default function TransferIssuesDialog({
  cycle,
  projectKey,
  onClose,
}: {
  cycle: Cycle;
  projectKey: string;
  onClose: () => void;
}) {
  const [target, setTarget] = useState<string>(NO_CYCLE);
  const transfer = useTransferCycleIssues(projectKey);
  const targets = (usePlannedCyclesQuery(projectKey).data ?? []).filter((c) => c.id !== cycle.id);

  const submit = async () => {
    try {
      const { moved } = await transfer.mutateAsync({
        id: cycle.id,
        targetCycleId: target === NO_CYCLE ? null : Number(target),
      });
      toast.success(moved === 1 ? '1 issue moved' : `${moved} issues moved`);
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not move the issues');
    }
  };

  return (
    <Modal
      title="Transfer unfinished issues"
      crumb={cycle.name}
      description="Issues that are not completed or canceled move to the cycle you pick. The rest stay here."
      projectKey={projectKey}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="transfer-target">Move to</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger id="transfer-target">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CYCLE}>No cycle</SelectItem>
              {targets.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name} ({formatShortDate(c.startDate)} – {formatShortDate(c.endDate)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={transfer.isPending} onClick={() => void submit()}>
            {transfer.isPending ? 'Moving…' : 'Move issues'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
