'use client';

import Link from 'next/link';
import { FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRelativeTime } from '@/context/relativeTimeContext';
import { documentPath } from '@/utils/paths';
import type { DocumentHomeCard } from '../../utils/documentHome';
import DocumentsHomeUnpinButton from './DocumentsHomeUnpinButton';

const CHILD_LIMIT = 4;

export default function DocumentsHomeCard({
  projectKey,
  card,
}: {
  projectKey: string;
  card: DocumentHomeCard;
}) {
  const t = useTranslations('documents');
  const relativeTime = useRelativeTime();
  const { page, children } = card;
  const href = documentPath(projectKey, page.id);
  const focus = 'outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <article className="group relative flex min-w-0 flex-col rounded-xl bg-card p-2 shadow-[var(--tile-shadow)]">
      <Link
        href={href}
        className={`flex items-center gap-3 rounded-lg p-2 pe-10 transition-colors hover:bg-accent ${focus}`}
      >
        <span
          className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-xl"
          aria-hidden
        >
          {page.icon || '📄'}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold tracking-[-0.01em]" dir="auto">
            {page.title.trim() || t('untitled')}
          </span>
          <span className="block text-xs text-muted-foreground">
            {t('home.pinnedMeta', { count: children.length, time: relativeTime(card.updatedAt) })}
          </span>
        </span>
      </Link>
      <DocumentsHomeUnpinButton projectKey={projectKey} page={page} />
      {children.length > 0 && (
        <ul className="mt-1">
          {children.slice(0, CHILD_LIMIT).map((child) => (
            <li key={child.id}>
              <Link
                href={documentPath(projectKey, child.id)}
                className={`flex h-8 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${focus}`}
              >
                <span
                  className="grid size-5 shrink-0 place-items-center text-[15px] leading-none"
                  aria-hidden
                >
                  {child.icon || <FileText className="size-3.5" />}
                </span>
                <span className="min-w-0 flex-1 truncate" dir="auto">
                  {child.title.trim() || t('untitled')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {children.length > CHILD_LIMIT && (
        <Link
          href={href}
          className={`mt-auto flex h-8 items-center rounded-md px-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${focus}`}
        >
          {t('seeAll', { count: children.length })}
        </Link>
      )}
    </article>
  );
}
