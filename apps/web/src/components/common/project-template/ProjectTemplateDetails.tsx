'use client';

import { useTranslations } from 'next-intl';
import type { ProjectTemplate } from '@/lib/api/endpoints/project-templates';
import { formatDate } from '@/utils/dates';
import { useProjectTemplateQuery } from '@/services/projectTemplates.service';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import ProjectTemplateContents from './ProjectTemplateContents';

// What a template is, then what a project created from it starts with.
export default function ProjectTemplateDetails({
  teamId,
  template,
}: {
  teamId: number;
  template: ProjectTemplate;
}) {
  const t = useTranslations('teams.templates.panel');
  const { data: detail } = useProjectTemplateQuery(teamId, template.id);

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        {template.description && (
          <p className="text-sm whitespace-pre-line text-foreground" dir="auto">
            {template.description}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {t('saved', { date: formatDate(template.createdAt) })}
        </p>
      </section>

      {detail ? (
        <ProjectTemplateContents template={detail} />
      ) : (
        <ListSkeleton rows={5} rowClassName="h-10" />
      )}
    </div>
  );
}
