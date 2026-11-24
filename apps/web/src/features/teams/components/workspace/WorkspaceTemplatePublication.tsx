'use client';

import { Copy, ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { TemplatePublication } from '@/lib/api/endpoints/project-templates';
import { formatDate } from '@/utils/dates';
import { Button } from '@/components/ui/button';

// The template's page in the gallery: since when it is up, and its link.
export default function WorkspaceTemplatePublication({
  publication,
}: {
  publication: TemplatePublication;
}) {
  const t = useTranslations('teams.templates.publish');

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publication.url);
      toast.success(t('linkCopied'));
    } catch {
      toast.error(t('copyFailed'));
    }
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border py-2.5 ps-3.5 pe-2">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2 text-[13px]">
          <span className="size-2 shrink-0 rounded-full bg-emerald-500 ring-[3px] ring-emerald-500/15" />
          <span className="font-medium">{t('live')}</span>
          <span className="text-muted-foreground">
            {t('since', { date: formatDate(publication.publishedAt) })}
          </span>
        </div>
        <a
          href={publication.url}
          target="_blank"
          rel="noreferrer"
          dir="ltr"
          className="truncate font-mono text-xs text-muted-foreground hover:text-foreground"
        >
          {publication.url.replace(/^https:\/\//, '')}
        </a>
      </div>
      <Button variant="ghost" size="icon-sm" title={t('copyLink')} onClick={() => void copyLink()}>
        <Copy />
      </Button>
      <Button variant="ghost" size="icon-sm" title={t('openPage')} asChild>
        <a href={publication.url} target="_blank" rel="noreferrer">
          <ExternalLink />
        </a>
      </Button>
    </div>
  );
}
