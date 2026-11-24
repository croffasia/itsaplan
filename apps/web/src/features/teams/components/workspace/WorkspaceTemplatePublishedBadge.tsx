'use client';

import { useTranslations } from 'next-intl';
import type { TemplatePublication } from '@/lib/api/endpoints/project-templates';
import { formatDate } from '@/utils/dates';
import { Badge } from '@/components/ui/badge';

// Marks a template published to the gallery and opens its page there.
export default function WorkspaceTemplatePublishedBadge({
  publication,
}: {
  publication: TemplatePublication;
}) {
  const t = useTranslations('teams.templates.publish');

  return (
    <Badge
      variant="outline"
      className="shrink-0 gap-1.5 rounded-full border-transparent bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      asChild
    >
      <a
        href={publication.url}
        target="_blank"
        rel="noreferrer"
        title={t('badgeHint', { date: formatDate(publication.publishedAt) })}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="size-1.5 rounded-full bg-current" />
        {t('badge')}
      </a>
    </Badge>
  );
}
