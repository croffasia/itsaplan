'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { ProjectTemplateDetail } from '@/lib/api/endpoints/project-templates';
import { useCopyColumns } from '@/hooks/useCopyColumns';
import ProjectTemplateConfiguration from './ProjectTemplateConfiguration';
import ProjectTemplateItems, { type TemplateItem } from './ProjectTemplateItems';
import ProjectTemplateLabels from './ProjectTemplateLabels';
import ProjectTemplateRow from './ProjectTemplateRow';
import ProjectTemplateStates from './ProjectTemplateStates';

// What a template holds, in the groups and the order "Save as template" offers them,
// the hosted build's parts included.
export default function ProjectTemplateContents({ template }: { template: ProjectTemplateDetail }) {
  const t = useTranslations('teams.templates.panel');
  const tFieldTypes = useTranslations('settings.customFields.fieldTypes');
  const columns = useCopyColumns(true);

  const typeName = (id: number | null) => template.issueTypes.find((type) => type.id === id)?.name;
  const named = (items: { id: number; name: string }[]) =>
    items.map((item) => ({ key: item.id, name: item.name }));

  const lists: Record<string, TemplateItem[]> = {
    issueTypes: template.issueTypes.map((x) => ({ key: x.id, name: x.name, color: x.color })),
    customFields: template.customFields.map((f) => ({
      key: f.id,
      name: f.name,
      hint: [tFieldTypes(f.fieldType), typeName(f.issueTypeId)].filter(Boolean).join(' · '),
    })),
    issueTemplates: named(template.issueTemplates),
    actions: named(template.actions),
    views: named(template.views),
    dashboards: named(template.dashboards),
    ...Object.fromEntries(
      template.sections.map((section) => [
        section.key,
        section.items.map((name, i) => ({ key: i, name })),
      ]),
    ),
  };
  const parts: Record<string, { count: number; body: ReactNode }> = {
    states: {
      count: template.columns.length,
      body: <ProjectTemplateStates columns={template.columns} />,
    },
    labels: {
      count: template.labels.length,
      body: <ProjectTemplateLabels labels={template.labels} groups={template.labelGroups} />,
    },
    ...Object.fromEntries(
      Object.entries(lists).map(([key, items]) => [
        key,
        {
          count: items.length,
          body: <ProjectTemplateItems items={items} list={key === 'customFields'} />,
        },
      ]),
    ),
  };

  return (
    <div className="space-y-6">
      {columns.flat().map((group) => (
        <section key={group.key}>
          <h3 className="pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {group.title}
          </h3>
          {group.options.map((option) => {
            if (option.key === 'configuration') {
              return (
                <ProjectTemplateConfiguration
                  key={option.key}
                  features={template.features}
                  estimates={template.estimates}
                />
              );
            }
            const part = parts[option.key];
            return (
              <ProjectTemplateRow key={option.key} label={option.label} count={part?.count ?? 0}>
                {part?.count ? (
                  part.body
                ) : (
                  <p className="text-sm text-muted-foreground">{t('none')}</p>
                )}
              </ProjectTemplateRow>
            );
          })}
        </section>
      ))}
    </div>
  );
}
