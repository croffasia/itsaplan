import type { Cycle } from '@/lib/api';
import { useCyclesQuery } from '@/services/cycles.service';
import { cycleDefaults } from '../utils/cycleDefaults';
import CycleForm from './CycleForm';

// Creating a cycle or editing one. A new cycle is filled in from the cycles the
// project already has — its name and dates continue the last one — so the form waits
// for that list before it opens. The page the dialog opens from has it loaded.
export default function CycleFormDialog({
  projectKey,
  cycle,
  onClose,
}: {
  projectKey: string;
  cycle?: Cycle;
  onClose: () => void;
}) {
  const { data: cycles } = useCyclesQuery(projectKey);
  if (!cycles) return null;

  return (
    <CycleForm
      projectKey={projectKey}
      cycle={cycle}
      cycles={cycles}
      defaults={cycleDefaults(cycles)}
      onClose={onClose}
    />
  );
}
