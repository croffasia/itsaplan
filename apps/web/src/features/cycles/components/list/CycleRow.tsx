import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Cycle } from '@/lib/api';
import { cyclePath } from '@/utils/paths';
import { formatShortDate } from '@/utils/dates';
import { CYCLE_STATUS_META } from '@/utils/cycleMeta';
import { colorDot } from '@/components/common/fields/colorDot';
import ProgressBar from '@/components/common/ProgressBar';
import { TableCell, TableRow } from '@/components/ui/table';

// The whole row navigates to the cycle; the name is also a real anchor so
// middle/cmd-click opens it in a new tab.
export default function CycleRow({ cycle, projectKey }: { cycle: Cycle; projectKey: string }) {
  const router = useRouter();
  const href = cyclePath(projectKey, cycle.id);

  return (
    <TableRow className="group/item cursor-pointer" onClick={() => router.push(href)}>
      <TableCell className="px-3 py-2.5 align-middle whitespace-normal">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="shrink-0">{colorDot(CYCLE_STATUS_META[cycle.status].color)}</span>
          <div className="min-w-0">
            <Link
              href={href}
              onClick={(e) => e.stopPropagation()}
              className="block truncate text-sm font-medium hover:underline"
            >
              {cycle.name}
            </Link>
            {cycle.goal && (
              <span className="block truncate text-xs text-muted-foreground">{cycle.goal}</span>
            )}
          </div>
        </div>
      </TableCell>

      <TableCell className="px-3 py-2.5 align-middle text-xs text-muted-foreground">
        {formatShortDate(cycle.startDate)} – {formatShortDate(cycle.endDate)}
      </TableCell>

      <TableCell className="px-3 py-2.5 align-middle">
        <ProgressBar progress={cycle.progress} />
      </TableCell>
    </TableRow>
  );
}
