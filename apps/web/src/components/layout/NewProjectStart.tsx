import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { ProjectTemplate } from '@/lib/api/endpoints/project-templates';
import { formatDate } from '@/utils/dates';
import ProjectTemplateDetails from '@/components/common/project-template/ProjectTemplateDetails';
import NewProjectOption from '@/components/layout/NewProjectOption';

// The first step while the team has templates: a blank project or one of the templates,
// and beside the list what the choice starts the project with. A blank project shows
// `blank`, the issue-type picker.
export default function NewProjectStart({
  teamId,
  templates,
  templateId,
  onTemplateChange,
  blank,
}: {
  teamId: number;
  templates: ProjectTemplate[];
  templateId: number | null;
  onTemplateChange: (next: number | null) => void;
  blank: ReactNode;
}) {
  const t = useTranslations('newProject');
  const tTemplates = useTranslations('teams.templates.panel');
  const template = templates.find((one) => one.id === templateId);

  return (
    <div className="grid gap-5 sm:h-[55vh] sm:grid-cols-[232px_minmax(0,1fr)]">
      <div
        role="radiogroup"
        aria-label={t('startFrom')}
        className="flex flex-col gap-0.5 sm:overflow-y-auto"
      >
        <NewProjectOption selected={!template} onSelect={() => onTemplateChange(null)}>
          <span className="block truncate">{t('blank')}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">
            {t('blankHint')}
          </span>
        </NewProjectOption>
        <span className="px-2 pt-3 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {t('templates')}
        </span>
        {templates.map((one) => (
          <NewProjectOption
            key={one.id}
            selected={one.id === templateId}
            onSelect={() => onTemplateChange(one.id)}
          >
            <span className="block truncate" dir="auto">
              {one.name}
            </span>
            <span className="block truncate text-xs font-normal text-muted-foreground">
              {tTemplates('saved', { date: formatDate(one.createdAt) })}
            </span>
          </NewProjectOption>
        ))}
      </div>

      <div className="min-w-0 space-y-4 sm:overflow-y-auto sm:border-s sm:ps-5">
        {template ? (
          <>
            <h3 className="text-base font-semibold" dir="auto">
              {template.name}
            </h3>
            <ProjectTemplateDetails teamId={teamId} template={template} />
          </>
        ) : (
          <>
            <div className="space-y-1">
              <h3 className="text-base font-semibold">{t('blank')}</h3>
              <p className="text-sm text-muted-foreground">{t('blankHint')}</p>
            </div>
            {blank}
          </>
        )}
      </div>
    </div>
  );
}
