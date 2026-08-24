import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Cycle } from '@/lib/api';
import { cyclePath } from '@/utils/paths';
import ProgressBar from '@/components/common/ProgressBar';
import CycleActions from '../CycleActions';
import CycleRange from '../CycleRange';
import { cycleLength, daysLeft } from '../../utils/cycleDates';

// One cycle as a table row. The whole row navigates to the cycle; the name is also
// a real anchor so middle/cmd-click opens it in a new tab.
export default function CycleTableRow({
  cycle,
  projectKey,
  gridTemplate,
  onTransfer,
}: {
  cycle: Cycle;
  projectKey: string;
  gridTemplate: string;
  onTransfer: (cycle: Cycle) => void;
}) {
  const router = useRouter();
  const href = cyclePath(projectKey, cycle.id);

  return (
    <div
      onClick={() => router.push(href)}
      className="grid cursor-pointer items-center gap-3 border-b px-4 py-2 text-sm hover:bg-accent/40"
      style={{ gridTemplateColumns: gridTemplate }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Link
          href={href}
          onClick={(e) => e.stopPropagation()}
          className="truncate font-medium hover:underline"
        >
          {cycle.name}
        </Link>
        {cycle.goal && <span className="truncate text-xs text-muted-foreground">{cycle.goal}</span>}
      </div>

      <span className="text-xs text-muted-foreground">
        <CycleRange cycle={cycle} />
        {cycle.status === 'active' && ` · ${daysLeft(cycle)}d left`}
      </span>

      <span className="text-xs text-muted-foreground tabular-nums">{cycleLength(cycle)}d</span>

      <span className="text-xs text-muted-foreground tabular-nums">{cycle.progress.total}</span>

      <ProgressBar progress={cycle.progress} />

      <div onClick={(e) => e.stopPropagation()} className="flex justify-end">
        <CycleActions cycle={cycle} projectKey={projectKey} onTransfer={onTransfer} />
      </div>
    </div>
  );
}
