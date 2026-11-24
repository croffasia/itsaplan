'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import Avatar from '@/components/common/Avatar';
import { useRelativeTime } from '@/context/relativeTimeContext';
import { commentPreview } from '@/utils/commentPreview';
import { documentPath } from '@/utils/paths';
import { useDocumentThreadsForYouQuery } from '../../services/documents.service';

const strong = (chunks: ReactNode) => <bdi className="font-medium text-foreground">{chunks}</bdi>;

// Open comment threads that wait for the viewer. Hidden while there are none.
export default function DocumentsHomeForYou({ projectKey }: { projectKey: string }) {
  const t = useTranslations('documents');
  const relativeTime = useRelativeTime();
  const threads = useDocumentThreadsForYouQuery(projectKey).data ?? [];
  if (threads.length === 0) return null;

  return (
    <section aria-labelledby="documents-home-for-you">
      <h2
        id="documents-home-for-you"
        className="mb-3 text-[13px] font-medium text-muted-foreground"
      >
        {t('home.forYou')}
      </h2>
      <ul className="flex flex-col">
        {threads.map((thread) => {
          const name = thread.authorName ?? t('comments.unknownAuthor');
          const values = {
            name,
            page: thread.documentTitle.trim() || t('untitled'),
            b: strong,
          };
          return (
            <li key={thread.threadId}>
              <Link
                href={`${documentPath(projectKey, thread.documentId)}?comment=${thread.threadId}`}
                className="flex min-w-0 items-start gap-3 rounded-md px-2 py-2.5 transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Avatar name={name} image={thread.authorImage} className="size-6" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm text-muted-foreground">
                    {thread.kind === 'mention'
                      ? t.rich('home.mentionedYou', values)
                      : t.rich('home.repliedToYou', values)}
                  </span>
                  <span className="truncate text-[13px] text-muted-foreground" dir="auto">
                    {commentPreview(thread.body)}
                  </span>
                </span>
                <time
                  dateTime={thread.createdAt}
                  className="w-22 shrink-0 text-end text-[13px] text-muted-foreground tabular-nums"
                >
                  {relativeTime(thread.createdAt)}
                </time>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
