import { useTranslations } from 'next-intl';
import { useCopySections } from '@/cloud';
import type { Messages } from '@/i18n/messages';
import type { CopyGroup, CopyOption } from '@/utils/copyOptions';

// The parts of a project a copy can carry over, in the columns they are shown in: the
// core's, with what the hosted build adds. With `template`, only what a project template
// carries.
export function useCopyColumns(template = false): CopyGroup[][] {
  const t = useTranslations('newProject');

  const option = (
    key: keyof Messages['newProject']['copyItems'],
    requires: string[] = [],
    inTemplate = true,
  ): CopyOption => ({ key, label: t(`copyItems.${key}`), requires, template: inTemplate });
  const group = (
    key: keyof Messages['newProject']['copyGroups'],
    options: CopyOption[],
  ): CopyGroup => ({ key, title: t(`copyGroups.${key}`), options });

  const columns = useCopySections([
    [
      group('workflow', [
        option('states'),
        option('issueTypes'),
        option('labels'),
        option('customFields', ['issueTypes']),
        option('issueTemplates', ['states', 'issueTypes', 'labels']),
        option('configuration'),
      ]),
    ],
    [
      group('automation', [
        option('actions', ['states', 'issueTypes', 'labels']),
        option('schedules', ['agents', 'states'], false),
        option('webhooks', [], false),
      ]),
    ],
    [group('aiTeam', [option('agents', [], false)])],
    [
      group('views', [
        option('views', ['states', 'issueTypes', 'labels', 'customFields']),
        option('dashboards'),
      ]),
      group('knowledge', [option('documents', [], false)]),
    ],
  ]);

  if (!template) return columns;
  return columns
    .map((column) =>
      column
        .map((g) => ({ ...g, options: g.options.filter((o) => o.template) }))
        .filter((g) => g.options.length > 0),
    )
    .filter((column) => column.length > 0);
}
