'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import Avatar from '@/components/common/Avatar';
import { useRelativeTime } from '@/context/relativeTimeContext';
import { useShell } from '@/context/shellContext';
import { useSession } from '@/lib/auth-client';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { documentPath } from '@/utils/paths';
import type { DocumentHomeRecentItem } from '../../utils/documentHome';
import { documentAncestors } from '../../utils/documentTree';
import DocumentsRailIcon from '../DocumentsRailIcon';

export default function DocumentsHomeRecentRow({
  projectKey,
  documents,
  item,
  showAuthor,
}: {
  projectKey: string;
  documents: ProjectDocumentSummary[];
  item: DocumentHomeRecentItem;
  showAuthor: boolean;
}) {
  const t = useTranslations('documents');
  const relativeTime = useRelativeTime();
  const { project } = useShell();
  const userId = useSession().data?.user.id;
  const { document, at } = item;
  const ancestors = documentAncestors(document, documents);
  const path =
    ancestors.map((ancestor) => ancestor.title.trim() || t('untitled')).join(' / ') ||
    (document.visibility === 'private' ? t('privatePages') : '');
  const authorId = document.updatedByUserId;
  const author = project?.assignees.find((candidate) => candidate.userId === authorId);
  const authorName =
    authorId === userId ? t('home.you') : (author?.name ?? t('comments.unknownAuthor'));

  return (
    <Link
      href={documentPath(projectKey, document.id)}
      className="flex h-10 min-w-0 items-center gap-3 rounded-md px-2 transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
    >
      <DocumentsRailIcon icon={document.icon} />
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="truncate text-sm font-medium" dir="auto">
          {document.title.trim() || t('untitled')}
        </span>
        {path && (
          <span className="min-w-0 truncate text-xs text-muted-foreground" dir="auto">
            {path}
          </span>
        )}
      </span>
      {showAuthor && authorId && (
        <span className="shrink-0" title={authorName}>
          <Avatar name={author?.name ?? authorName} image={author?.image} />
          <span className="sr-only" dir="auto">
            {authorName}
          </span>
        </span>
      )}
      <time
        dateTime={new Date(at).toISOString()}
        className="w-26 shrink-0 text-end text-[13px] whitespace-nowrap text-muted-foreground tabular-nums"
      >
        {Date.now() - at < 60_000 ? t('home.justNow') : relativeTime(new Date(at))}
      </time>
    </Link>
  );
}
