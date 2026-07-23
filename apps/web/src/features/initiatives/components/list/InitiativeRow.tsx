import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Minus } from 'lucide-react';
import type { Initiative, Assignee } from '@/lib/api';
import { initiativePath } from '@/utils/paths';
import { formatShortDate } from '@/utils/dates';
import { AssigneeAvatar } from '@/features/issue/components/shared/IssueBadges';
import { PriorityIcon } from '@/features/issue/components/shared/IssueIcons';
import { colorDot } from '@/components/common/fields/colorDot';
import { TableCell, TableRow } from '@/components/ui/table';
import { STATUS_META } from '@/utils/initiativeMeta';
import HealthBadge from '../shared/HealthBadge';
import ProgressBar from '../shared/ProgressBar';

// The whole row navigates to the detail page; the title is also a real anchor so
// middle/cmd-click opens it in a new tab.
export default function InitiativeRow({
  initiative,
  projectKey,
  owner,
}: {
  initiative: Initiative;
  projectKey: string;
  owner: Assignee | null;
}) {
  const router = useRouter();
  const href = initiativePath(projectKey, initiative.id);

  return (
    <TableRow className="group/item cursor-pointer" onClick={() => router.push(href)}>
      <TableCell className="px-3 py-2.5 align-middle whitespace-normal">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="shrink-0">{colorDot(STATUS_META[initiative.status].color)}</span>
          <div className="min-w-0">
            <Link
              href={href}
              onClick={(e) => e.stopPropagation()}
              className="block truncate text-sm font-medium hover:underline"
            >
              {initiative.title}
            </Link>
            {initiative.description && (
              <span className="block truncate text-xs text-muted-foreground">
                {initiative.description}
              </span>
            )}
          </div>
        </div>
      </TableCell>

      <TableCell className="px-3 py-2.5 align-middle">
        {initiative.priority ? (
          <span className="flex items-center gap-1.5 text-sm">
            <PriorityIcon priority={initiative.priority} className="size-3.5" />
            <span className="text-muted-foreground capitalize">{initiative.priority}</span>
          </span>
        ) : (
          <Minus className="size-3.5 text-muted-foreground" />
        )}
      </TableCell>

      <TableCell className="px-3 py-2.5 align-middle">
        {owner ? (
          <span className="flex items-center gap-1.5 text-sm">
            <AssigneeAvatar name={owner.name} image={owner.image} />
            <span className="truncate text-muted-foreground">{owner.name}</span>
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Unassigned</span>
        )}
      </TableCell>

      <TableCell className="px-3 py-2.5 align-middle text-xs text-muted-foreground">
        {initiative.targetDate ? formatShortDate(initiative.targetDate) : '—'}
      </TableCell>

      <TableCell className="px-3 py-2.5 align-middle">
        <ProgressBar progress={initiative.progress} />
      </TableCell>

      <TableCell className="px-3 py-2.5 align-middle">
        <HealthBadge health={initiative.health} />
      </TableCell>
    </TableRow>
  );
}
