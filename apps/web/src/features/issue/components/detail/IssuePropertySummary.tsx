import { cn } from '@/lib/utils';
import type { IssuePropertyRowSpec } from '../../hooks/useIssuePropertyRows';
import { BARE_PILLS } from '../../utils/barePills';
import { summaryRows } from '../../utils/propertySummary';

// The fields folded Properties still show, in one wrapping row, each still editable.
export default function IssuePropertySummary({
  rows,
  className,
}: {
  rows: IssuePropertyRowSpec[];
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-0.5', BARE_PILLS, className)}>
      {summaryRows(rows).map((row) => (
        <div key={row.key} className="min-w-0">
          {row.node}
        </div>
      ))}
    </div>
  );
}
