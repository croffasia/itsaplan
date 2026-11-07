'use client';

import { Fragment } from 'react';
import { ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type {
  TemplatePublisher,
  WorkspaceProjectTemplate,
} from '@/lib/api/endpoints/project-templates';
import { useProjectTemplateQuery } from '@/services/projectTemplates.service';
import { colorDot } from '@/components/common/fields/colorDot';
import { Button } from '@/components/ui/button';

// The template as the gallery lists it, under the address's author.
export default function WorkspaceTemplateGalleryPreview({
  workspaceId,
  template,
  publisher,
  onChangeAuthor,
}: {
  workspaceId: number;
  template: WorkspaceProjectTemplate;
  publisher: TemplatePublisher;
  onChangeAuthor: () => void;
}) {
  const t = useTranslations('teams.templates.publish');
  const tCommon = useTranslations('common');
  const { data } = useProjectTemplateQuery({ workspaceId }, template.id);

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1">
          {data?.columns.map((column) => (
            <Fragment key={column.id}>{colorDot(column.color)}</Fragment>
          ))}
        </div>
        <span
          className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase"
          dir="ltr"
        >
          itsaplan.dev/templates
        </span>
      </div>
      <p className="text-sm font-semibold wrap-anywhere" dir="auto">
        {template.name}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
          {data &&
            t('counts', {
              states: data.columns.length,
              types: data.issueTypes.length,
              fields: data.customFields.length,
            })}
        </span>
        <span className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
          {t.rich('by', {
            name: publisher.authorName,
            b: (chunks) => (
              <span className="truncate font-medium text-foreground" dir="auto">
                {chunks}
              </span>
            ),
          })}
          {publisher.authorUrl && <ExternalLink className="size-3 shrink-0" />}
          <Button variant="link" size="sm" className="ms-1 h-auto p-0" onClick={onChangeAuthor}>
            {tCommon('change')}
          </Button>
        </span>
      </div>
    </div>
  );
}
