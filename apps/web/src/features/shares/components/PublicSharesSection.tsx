import type { LucideIcon } from 'lucide-react';
import type { ShareKind } from '../services/shares.service';
import PublicShareRow, { type PublicShareRowData } from './PublicShareRow';

// One kind of shared entity on the Public page. Renders nothing when none is shared.
export default function PublicSharesSection({
  projectKey,
  kind,
  title,
  icon,
  canRevoke,
  rows,
}: {
  projectKey: string;
  kind: ShareKind;
  title: string;
  icon: LucideIcon;
  canRevoke: boolean;
  rows: PublicShareRowData[];
}) {
  if (rows.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-muted-foreground">
        {title} · {rows.length}
      </h2>
      <ul className="divide-y rounded-md border">
        {rows.map((row) => (
          <PublicShareRow
            key={row.id}
            projectKey={projectKey}
            kind={kind}
            icon={icon}
            canRevoke={canRevoke}
            row={row}
          />
        ))}
      </ul>
    </section>
  );
}
