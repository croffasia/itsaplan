'use client';

import { useTranslations } from 'next-intl';
import type { TemplateContents } from '@/lib/api/endpoints/project-templates';
import ProjectTemplateContents from '@/components/common/project-template/ProjectTemplateContents';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';

// The template being saved or edited, as the new project dialog will show it. `contents`
// is undefined while it loads.
export default function WorkspaceTemplatePreview({
  name,
  description,
  contents,
}: {
  name: string;
  description: string;
  contents: TemplateContents | undefined;
}) {
  const t = useTranslations('projects.saveTemplate');

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold" dir="auto">
        {name || t('newTitle')}
      </h3>
      <div className="space-y-8">
        {description && (
          <p className="text-sm whitespace-pre-line text-foreground" dir="auto">
            {description}
          </p>
        )}
        {contents ? (
          <ProjectTemplateContents template={contents} />
        ) : (
          <ListSkeleton rows={5} rowClassName="h-10" />
        )}
      </div>
    </div>
  );
}
