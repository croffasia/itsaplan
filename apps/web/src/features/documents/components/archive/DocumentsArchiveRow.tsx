import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { Assignee } from '@/lib/api/endpoints/projects';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import Avatar from '@/components/common/Avatar';
import { TableCell, TableRow } from '@/components/ui/table';
import { formatShortDate } from '@/utils/dates';
import { documentPath } from '@/utils/paths';
import DocumentsRailIcon from '../DocumentsRailIcon';
import DocumentsArchiveRowMenu from './DocumentsArchiveRowMenu';

const CELL = 'px-3 py-3 align-middle whitespace-normal';

// An archived page with where it was, who archived it and when. Restore and Delete show to
// those who may use them: the page owner, or a project owner.
export default function DocumentsArchiveRow({
  projectKey,
  document,
  path,
  archivedBy,
  canManage,
  pending,
  onRestore,
  onDelete,
}: {
  projectKey: string;
  document: ProjectDocumentSummary;
  path: string;
  archivedBy: Assignee | undefined;
  canManage: boolean;
  pending: boolean;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('documents');
  const title = document.title.trim() || t('untitled');

  return (
    <TableRow>
      <TableCell className={CELL}>
        <Link
          href={documentPath(projectKey, document.id)}
          className="flex min-w-0 items-center gap-2.5 rounded-sm text-sm font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <DocumentsRailIcon icon={document.icon} />
          <span className="truncate" dir="auto">
            {title}
          </span>
        </Link>
      </TableCell>
      <TableCell className={`${CELL} text-[13px] text-muted-foreground`}>
        <span className="block truncate" dir="auto">
          {path || '—'}
        </span>
      </TableCell>
      <TableCell className={CELL}>
        {archivedBy ? (
          <span className="flex min-w-0 items-center gap-2 text-[13px]">
            <Avatar name={archivedBy.name} image={archivedBy.image} />
            <span className="truncate" dir="auto">
              {archivedBy.name}
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className={`${CELL} text-[13px] text-muted-foreground tabular-nums`}>
        {document.archivedAt && (
          <time dateTime={document.archivedAt}>{formatShortDate(document.archivedAt)}</time>
        )}
      </TableCell>
      <TableCell className="px-3 py-2 align-middle">
        {canManage && (
          <DocumentsArchiveRowMenu
            title={title}
            pending={pending}
            onRestore={onRestore}
            onDelete={onDelete}
          />
        )}
      </TableCell>
    </TableRow>
  );
}
