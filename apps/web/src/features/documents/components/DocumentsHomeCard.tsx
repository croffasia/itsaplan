'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { DocumentHomeCard } from '../utils/documentHome';
import DocumentsHomeLink from './DocumentsHomeLink';

const CHILD_LIMIT = 5;

export default function DocumentsHomeCard({
  projectKey,
  card,
  onSeeAll,
}: {
  projectKey: string;
  card: DocumentHomeCard;
  onSeeAll: () => void;
}) {
  const t = useTranslations('documents');
  const children = card.children.slice(0, CHILD_LIMIT);

  return (
    <section className="flex min-w-0 flex-col rounded-lg border bg-card p-2">
      <DocumentsHomeLink projectKey={projectKey} document={card.page} className="font-semibold" />
      {children.length > 0 && (
        <ul className="mt-1 border-t pt-1">
          {children.map((child) => (
            <li key={child.id}>
              <DocumentsHomeLink
                projectKey={projectKey}
                document={child}
                className="text-muted-foreground hover:text-foreground"
              />
            </li>
          ))}
        </ul>
      )}
      {card.children.length > CHILD_LIMIT && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-1 h-7 self-start px-2 text-xs text-muted-foreground"
          onClick={onSeeAll}
        >
          {t('seeAll', { count: card.children.length })}
        </Button>
      )}
    </section>
  );
}
